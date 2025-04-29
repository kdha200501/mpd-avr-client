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
} = require('rxjs');
const {
  share,
  filter,
  delay,
  map,
  scan,
  withLatestFrom,
  takeUntil,
} = require('rxjs/operators');

const {
  AvrService,
  AvrWakeUpVolumeStatusReducer,
  AppStateService,
  AppStateReducer,
  AppStateRenderer,
  PromptRenderer,
  AppTerminator,
  getMpClientEvent,
  getCecClientEvent,
} = require('./utils');

/**
 * @desc Scope members
 */
const cecClientProcess = spawn('cec-client', ['-o', 'Loading...']); // read-write stream
const mpClientProcess = spawn('mpc', ['idleloop']); // read-only stream

const appStateService = new AppStateService(cecClientProcess);
const avrService = new AvrService(cecClientProcess);
const appTerminator = new AppTerminator();

const initAppState$ = /** @type Observable<AppState> */ appStateService
  .getInitAppState()
  .pipe(share());

const mpClientEvent$ = /** @type Observable<MpClientEvent> */ getMpClientEvent(
  mpClientProcess
).pipe(share()); // music player service event listener

const cecClientEvent$ =
  /** @type Observable<CecClientEvent> */ getCecClientEvent(
    cecClientProcess
  ).pipe(share()); // cec service event listener

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
    takeUntil(appTerminator.destroy$),
    share()
  );

/**
 * @desc OnInit
 */
combineLatest(appStateChange$, initialAvrPowerStatusAndSubsequentPowerOn$)
  .pipe(
    map(([appState]) => appState),
    takeUntil(appTerminator.destroy$)
  )
  .subscribe(new AppStateRenderer(cecClientProcess)); // update OSD according to application state change

postInitialAvrPowerStatusCecClientEvent$
  .pipe(withLatestFrom(appStateChange$), takeUntil(appTerminator.destroy$))
  .subscribe(new PromptRenderer(cecClientProcess)); // update OSD according to prompt

postInitialAvrPowerStatusCecClientEvent$
  .pipe(
    scan(
      new AvrWakeUpVolumeStatusReducer(cecClientProcess),
      /** @type AvrVolumeStatus */ []
    ),
    filter(([avrMuteAndVolumeInHex]) => avrMuteAndVolumeInHex !== undefined),
    switchMap((avrVolumeStatus) =>
      avrService.adjustAudioVolume(avrVolumeStatus)
    ),
    takeUntil(appTerminator.destroy$)
  )
  .subscribe(); // reset volume when the AVR wakes up

cecClientEvent$.pipe(takeUntil(appTerminator.destroy$)).subscribe({
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

mpClientEvent$.pipe(takeUntil(appTerminator.destroy$)).subscribe({
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
