'use strict';

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

const { getInstance: getCecClient } = require('../src/clients/cec-client');
const { getInstance: getMpClient } = require('../src/clients/mp-client');
const AvrService = require('../src/services/avr-service');
const AvrPowerStatusReducer = require('../src/reducers/avr-power-status-reducer');
const AvrWakeUpVolumeStatusReducer = require('../src/reducers/avr-wake-up-volume-status-reducer');
const AvrAudioSourceSwitchReducer = require('../src/reducers/avr-audio-source-switch-reducer');
const PlaylistService = require('../src/services/playlist-service');
const MpService = require('../src/services/mp-service');
const AppStateService = require('../src/services/app-state-service');
const AppStateReducer = require('../src/reducers/app-state-reducer');
const AppStateRenderer = require('../src/renderers/app-state-renderer');
const PromptRenderer = require('../src/renderers/prompt-renderer');
const AppTerminator = require('../src/app-terminator');

const describe = 'AVR as a MPD client';

/** @type {import('yargs').CommandModule<{}, AppConfig>} */
module.exports = {
  command: '$0',
  describe,

  builder: (yargs) =>
    yargs
      .usage('Usage: $0 [options]')
      .option('osdMaxLength', {
        alias: 'o',
        nargs: 1,
        type: 'number',
        default: 14,
        description:
          'Specify the maximum number of characters that can be put on the OSD',
      })
      .option('audioVolumePreset', {
        alias: 'v',
        nargs: 1,
        type: 'number',
        description:
          'Optionally set the audio volume (0-100) when the AVR wakes up. For Yamaha RX-V385, -43dB corresponds to 38.',
      })
      .option('handOverAudioToTvCecCommand', {
        alias: 't',
        nargs: 1,
        type: 'string',
        description:
          'Optionally provide the CEC command for the AVR to switch audio source to a TV that is connected via a non-HDMI input, e.g. `tx 15:44:69:09`. Use the blue button to switch audio source.',
      })
      .option('audioVolumePresetForTv', {
        alias: 'T',
        nargs: 1,
        type: 'number',
        description:
          'Optionally set the audio volume when the AVR switches audio source to TV',
      })
      .option('braviaLaunchProfile', {
        alias: 'b',
        nargs: 1,
        type: 'string',
        description:
          'Optionally provide the path to a launch profile for Sony Bravia TV. This powers on TV when the AVR switches audio source to a TV.',
      })
      .option('goveeLaunchProfile', {
        alias: 'g',
        nargs: 1,
        type: 'string',
        description:
          'Optionally provide the path to a launch profile for Govee LED strip for TV. This powers on LEDs when the AVR switches audio source to a TV.',
      }),

  handler: (appConfig) => {
    /**
     * @desc Protocol clients
     */
    const cecClient = getCecClient(); // read-write client
    const mpClient = getMpClient(); // read-only client

    /**
     * @desc Services
     */
    const avrService = new AvrService(appConfig);
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
      scan(...new AvrPowerStatusReducer(appConfig)),
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
      scan(...new AppStateReducer(appConfig)),
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
      .subscribe(new AppStateRenderer(appConfig)); // update OSD according to application state change

    postInitialAvrPowerStatusCecClientEvent$
      .pipe(withLatestFrom(appStateChange$), takeUntil(destroy$))
      .subscribe(new PromptRenderer(appConfig)); // update OSD according to prompt

    const { audioVolumePreset, handOverAudioToTvCecCommand } =
      /** @type AppConfig */ appConfig;

    if (audioVolumePreset !== undefined) {
      postInitialAvrPowerStatusCecClientEvent$
        .pipe(
          scan(...new AvrWakeUpVolumeStatusReducer(appConfig)),
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
          scan(...new AvrAudioSourceSwitchReducer(appConfig)),
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
  },
};
