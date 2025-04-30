#!/usr/bin/env node

'use strict';

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
const avrService = new AvrService(cecClientProcess);
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
    new AvrPowerStatusReducer(cecClientProcess),
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
    new AppStateReducer(cecClientProcess),
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

/**
 * @desc OnInit
 */
combineLatest(appStateChange$, initialAvrPowerStatusAndSubsequentPowerOn$)
  .pipe(
    map(([appState]) => appState),
    takeUntil(destroy$)
  )
  .subscribe(new AppStateRenderer(cecClientProcess)); // update OSD according to application state change

postInitialAvrPowerStatusCecClientEvent$
  .pipe(withLatestFrom(appStateChange$), takeUntil(destroy$))
  .subscribe(new PromptRenderer(cecClientProcess)); // update OSD according to prompt

postInitialAvrPowerStatusCecClientEvent$
  .pipe(
    scan(
      new AvrWakeUpVolumeStatusReducer(cecClientProcess),
      /** @type AvrVolumeStatus */ []
    ),
    filter(avrService.isAvrVolumeStatsValid),
    switchMap((avrVolumeStatus) =>
      avrService.adjustAudioVolume(avrVolumeStatus)
    ),
    takeUntil(destroy$)
  )
  .subscribe(); // reset volume when the AVR wakes up

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
