#!/usr/bin/env node

'use strict';

/**
 * @desc Notes
 * - The `on 5` command causes the AVR to stop emitting standby events. This application will not turn on the AVR programmatically
 */

const { spawn } = require('child_process');
const {
  Observable,
  merge,
  Subject,
  distinctUntilChanged,
  forkJoin,
  concat,
  combineLatest,
} = require('rxjs');
const {
  share,
  filter,
  delay,
  take,
  map,
  scan,
  withLatestFrom,
  takeUntil,
} = require('rxjs/operators');

const {
  sendMpCommand,
  updatePlaylists,
  isAppStateChanged,
  getMpClientEvent,
  getCecClientEvent,
  isAvrRequestDisplayName,
  AvrPowerStatusReducer,
  createAppState,
  AppStateReducer,
  AppStateRenderer,
  PromptRenderer,
} = require('./utils');

/**
 * @desc TTY process as API service
 */
const cecClientProcess = spawn('cec-client', ['-o', 'Loading...']); // read-write stream

const mpClientProcess = spawn('mpc', ['idleloop']); // read-only stream

/**
 * @desc Subjects
 */
const destroy$ = new Subject();

/**
 * @desc Scoped methods
 */

/**
 * Cleanup task
 * @param {boolean} [isKillSignal] Whether the cleanup task is triggered by a kill event
 * @returns {void}
 */
const onExit = (isKillSignal = false) => {
  cecClientProcess && cecClientProcess.kill();
  mpClientProcess && mpClientProcess.kill();

  destroy$.next(null);
  destroy$.complete();

  if (isKillSignal) {
    return;
  }

  process.exit();
};

/**
 * @desc OnInit - Observables
 */
const mpClientEvent$ = /** @type Observable<MpClientEvent> */ getMpClientEvent(
  mpClientProcess
).pipe(share()); // music player service event listener

const cecClientEvent$ =
  /** @type Observable<CecClientEvent> */ getCecClientEvent(
    cecClientProcess
  ).pipe(share()); // cec service event listener

const avrPowerStatus$ =
  /** @type {Observable<AvrPowerStatus>} */ cecClientEvent$.pipe(
    scan(
      new AvrPowerStatusReducer(cecClientProcess),
      /** @type AvrPowerStatus */ []
    ),
    filter(([isAudioDeviceOn]) => isAudioDeviceOn !== undefined),
    take(1)
  );

const playlistsUpdatePromise = updatePlaylists();

const initAppState$ = /** @type {Observable<AppState>} */ forkJoin(
  avrPowerStatus$,
  playlistsUpdatePromise.then(() => sendMpCommand('update')),
  playlistsUpdatePromise
).pipe(
  map(([avrPowerStatus, mpStatus, playlists]) =>
    createAppState(avrPowerStatus, mpStatus, playlists)
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
  distinctUntilChanged(isAppStateChanged),
  share()
);

const avrRequestDisplayName$ =
  /** @type {Observable<CecClientEvent>} */ cecClientEvent$.pipe(
    filter(isAvrRequestDisplayName),
    delay(500)
  );

const initialAvrPowerStatusAndSubsequentPowerOn$ =
  /** @type {Observable<void>} */ concat(
    initAppState$,
    avrRequestDisplayName$
  ).pipe(map(() => undefined));

/**
 * @desc OnInit - Subscriptions
 */
combineLatest(appStateChange$, initialAvrPowerStatusAndSubsequentPowerOn$)
  .pipe(
    map(([appState]) => appState),
    takeUntil(destroy$)
  )
  .subscribe(new AppStateRenderer(cecClientProcess)); // update OSD according to application state change

combineLatest(initAppState$, cecClientEvent$)
  .pipe(withLatestFrom(appStateChange$), takeUntil(destroy$))
  .subscribe(new PromptRenderer(cecClientProcess)); // update OSD according to prompt

cecClientEvent$.pipe(takeUntil(destroy$)).subscribe({
  // on next
  next: (output) => {
    /**
     * @desc debug
     */
    // console.log(output);
  },
  // on complete
  complete: onExit,
  // on error
  error: onExit,
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
  complete: onExit,
  // on error
  error: onExit,
}); // service watchdog

/**
 * @desc OnDestroy
 */
process.on('SIGINT', () => onExit(true));
