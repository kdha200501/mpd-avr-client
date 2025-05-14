#!/usr/bin/env node

'use strict';

const { argv: appConfig } = require('yargs')
  .usage('Usage: $0 [options]')
  .alias('o', 'osdMaxLength')
  .nargs('o', 1)
  .number('o')
  .default('o', 14)
  .describe(
    'o',
    'Specify the maximum number of characters that can be put on the OSD'
  )
  .alias('v', 'audioVolumePreset')
  .nargs('v', 1)
  .number('v')
  .describe(
    'v',
    'Optionally set the audio volume when the AVR wakes up. Conversion from gain level to volume level can vary depending on the model. For Yamaha RX-V385, -43dB is 38.'
  )
  .alias('t', 'handOverAudioToTvCecCommand')
  .nargs('t', 1)
  .string('t')
  .describe(
    't',
    'Optionally provide the CEC command for the AVR to switch audio source to a TV that is connected via a non-HDMI input, e.g. `tx 15:44:69:09`. Use the blue button to switch audio source.'
  )
  .alias('T', 'audioVolumePresetForTv')
  .nargs('T', 1)
  .number('T')
  .describe(
    'T',
    'Optionally set the audio volume when the AVR switches audio source to TV'
  )
  .help('h')
  .alias('h', 'help');
const { spawn } = require('child_process');
const {
  Observable,
  merge,
  distinctUntilChanged,
  switchMap,
  concat,
  combineLatest,
  forkJoin,
} = require('rxjs');
const {
  share,
  filter,
  delay,
  map,
  scan,
  withLatestFrom,
  takeUntil,
  take,
} = require('rxjs/operators');

const {
  CecClient,
  MpClient,
  AvrService,
  AvrPowerStatusReducer,
  AvrWakeUpVolumeStatusReducer,
  AvrAudioSourceSwitchReducer,
  PlaylistService,
  MpService,
  AppStateService,
  AppStateReducer,
  AppStateRenderer,
  PromptRenderer,
  AppTerminator,
} = require('./utils');

/**
 * @desc Protocol clients
 */
const cecClientProcess = spawn('cec-client', ['-o', 'Loading...']); // read-write client
const cecClient = new CecClient(cecClientProcess);

const mpClientProcess = spawn('mpc', ['idleloop']); // read-only client
const mpClient = new MpClient(mpClientProcess);

/**
 * @desc Services
 */
const avrService = new AvrService(appConfig, cecClientProcess);
const playlistService = new PlaylistService();
const mpService = new MpService();
const appStateService = new AppStateService();
const appTerminator = new AppTerminator();

/**
 * @desc Scope members
 */
const mpClientEvent$ = mpClient.publisher();
const cecClientEvent$ = cecClient.publisher();
const destroy$ = appTerminator.publisher();

const avrPowerStatus$ = /** @type AvrPowerStatus */ cecClientEvent$.pipe(
  scan(
    new AvrPowerStatusReducer(appConfig, cecClientProcess),
    /** @type AvrPowerStatus */ []
  ),
  filter(avrService.isAvrPowerStatusValid),
  take(1)
);

const playlistsUpdatePromise = playlistService.updatePlaylists();

const initAppState$ = /** @type {Observable<AppState>} */ forkJoin(
  avrPowerStatus$,
  playlistsUpdatePromise.then(() => mpService.update()),
  playlistsUpdatePromise
).pipe(
  map(([avrPowerStatus, mpStatus, playlists]) =>
    appStateService.createAppState(avrPowerStatus, mpStatus, playlists)
  ),
  share()
);

const appStateChange$ = /** @type {Observable<AppState>} */ concat(
  initAppState$,
  /**
   * @desc
   * - Subsequent AVR actions and state changes
   * - Subsequent MPD state changes
   */
  merge(cecClientEvent$, mpClientEvent$)
).pipe(
  scan(
    new AppStateReducer(appConfig, cecClientProcess),
    /**
     * @desc the application state placeholder
     * @type AppState
     */
    undefined
  ),
  distinctUntilChanged(appStateService.isAppStateChanged),
  share()
);

const avrRequestDisplayName$ =
  /** @type {Observable<CecClientEvent>} */ cecClientEvent$.pipe(
    filter(avrService.isAvrRequestDisplayName),
    /**
     * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
     */
    delay(500)
  );

const initialAvrPowerStatusAndSubsequentPowerOn$ =
  /** @type {Observable<void>} */ concat(
    initAppState$,
    avrRequestDisplayName$
  ).pipe(map(() => undefined));

const postInitialAvrPowerStatusCecClientEvent$ =
  /** @type Observable<CecClientEvent> */ initAppState$.pipe(
    switchMap(() => cecClientEvent$),
    takeUntil(destroy$),
    share()
  );

const postInitialAvrPowerStatusMpClientEvent$ =
  /** @type Observable<MpClientEvent> */ initAppState$.pipe(
    switchMap(() => mpClientEvent$),
    takeUntil(destroy$),
    share()
  );

/**
 * @desc OnInit
 */
combineLatest(appStateChange$, initialAvrPowerStatusAndSubsequentPowerOn$)
  .pipe(
    map(([appState]) => appState),
    takeUntil(destroy$)
  )
  .subscribe(new AppStateRenderer(appConfig, cecClientProcess)); // update OSD according to application state change

postInitialAvrPowerStatusCecClientEvent$
  .pipe(withLatestFrom(appStateChange$), takeUntil(destroy$))
  .subscribe(new PromptRenderer(appConfig, cecClientProcess)); // update OSD according to prompt

const { audioVolumePreset, handOverAudioToTvCecCommand } =
  /** @type AppConfig */ appConfig;

if (audioVolumePreset !== undefined) {
  postInitialAvrPowerStatusCecClientEvent$
    .pipe(
      scan(
        new AvrWakeUpVolumeStatusReducer(appConfig, cecClientProcess),
        /** @type AvrVolumeStatus */ []
      ),
      filter(avrService.isAvrVolumeStatsValid),
      switchMap((avrVolumeStatus) =>
        avrService.adjustAudioVolume(avrVolumeStatus)
      ),
      takeUntil(destroy$)
    )
    .subscribe(); // reset volume when the AVR wakes up
}

if (handOverAudioToTvCecCommand) {
  merge(
    postInitialAvrPowerStatusCecClientEvent$,
    postInitialAvrPowerStatusMpClientEvent$
  )
    .pipe(
      withLatestFrom(appStateChange$),
      scan(
        new AvrAudioSourceSwitchReducer(appConfig, cecClientProcess),
        /** @type {[AvrVolumeStatus, MpStatusStateTransition]} */
        [[], [undefined, undefined]]
      ),
      takeUntil(destroy$)
    )
    .subscribe(); // switch audio source
}

cecClientEvent$.pipe(takeUntil(destroy$)).subscribe({
  // on next
  next: (output) => {
    /**
     * @desc debug
     */
    // console.log(output);
  },
  // on complete
  complete: () => appTerminator.onExit,
  // on error
  error: () => appTerminator.onExit,
}); // service watchdog

mpClientEvent$.pipe(takeUntil(destroy$)).subscribe({
  // on next
  next: (output) => {
    /**
     * @desc debug
     */
    // console.log(output);
  },
  // on complete
  complete: () => appTerminator.onExit,
  // on error
  error: () => appTerminator.onExit,
}); // service watchdog

/**
 * @desc OnDestroy
 */
process.on('SIGINT', () => appTerminator.onExit(true));
