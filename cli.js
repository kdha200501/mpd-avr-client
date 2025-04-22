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
const { share, filter, take, map, scan, takeUntil } = require('rxjs/operators');

const {
  audioDeviceRequestDisplayNameRegExp,
  playOrPauseRegExp,
} = require('./const');
const {
  sendMpCommand,
  getIsAudioDeviceOn,
  updatePlaylists,
  onAudioDeviceChange,
  onRemoteControlKeyup,
  onMpStateChange,
  isAppStateChanged,
  getMpClientEvent,
  getCecClientEvent,
  displayAppState,
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
 * @desc OnInit - Application State Reducer
 */
const mpClientEvent$ = /** @type Observable<MpClientEvent> */ getMpClientEvent(
  mpClientProcess
).pipe(share()); // music player service event listener

const cecClientEvent$ =
  /** @type Observable<CecClientEvent> */ getCecClientEvent(
    cecClientProcess
  ).pipe(share()); // cec service event listener

const isAudioDeviceOn$ =
  /** @type {Observable<[boolean]>} */ cecClientEvent$.pipe(
    scan((acc, { data }) => {
      const { length } = acc;

      // if the request for AVR power status has been made
      if (length) {
        // then deduce the AVR power statue from transmissions received
        return [getIsAudioDeviceOn(data)];
      }

      // if the request for AVR power status has not been made, and
      // if the AVR is reaching out to identify the host
      if (audioDeviceRequestDisplayNameRegExp.test(data)) {
        // then make a request for AVR power status
        /**
         * @desc when the host jumps on the HDMI bus, the audio device reaches out to the host and asks for identification
         */
        cecClientProcess.stdin.write('pow 5');
        return [undefined];
      }

      // if the request for AVR power status has not been made, and
      // if the AVR is not reaching out to identify the host,
      // then no-op
      return acc;
    }, []),
    filter(([audioDeviceIsOn]) => audioDeviceIsOn !== undefined),
    take(1),
    share()
  );

const playlistsUpdatePromise = updatePlaylists();

const initAppState$ = /** @type {Observable<AppState>} */ forkJoin(
  isAudioDeviceOn$,
  playlistsUpdatePromise.then(() => sendMpCommand('update')),
  playlistsUpdatePromise
).pipe(
  map(([[isAudioDeviceOn], { state }, playlists]) => ({
    isAudioDeviceOn,
    state,
    showPlaylist: !playOrPauseRegExp.test(state),
    playlistIdx: 0,
    playlists,
  }))
);

const currentAppState$ = /** @type {Observable<AppState>} */ concat(
  initAppState$,
  /**
   * @desc
   * - Subsequent AVR actions and state changes
   * - Subsequent MPD state changes
   */
  merge(cecClientEvent$, mpClientEvent$)
).pipe(
  /**
   * @desc implement state management as a reducer
   */
  scan(
    (currentAppState, event) => {
      if (!event) {
        return;
      }

      // if handling the initial application state
      if (currentAppState === undefined) {
        // then initialize the application state
        return { ...event };
      }

      const { data, source } =
        /** @type {CecClientEvent|MpClientEvent} */ event;

      // if handling a subsequent actions or state change
      switch (source) {
        // then mutate the application state

        // if the event comes from the music player
        case 'mpClient':
          // then update the application state to sync up with the music player state
          return onMpStateChange(/** @type MpStatus */ data, currentAppState);

        // if the event comes from the CEC client
        case 'cecClient':
          // then update the application state according to the action
          const isAudioDeviceOn = getIsAudioDeviceOn(
            /** @type CecTransmission */ data
          );

          if (isAudioDeviceOn !== undefined) {
            return onAudioDeviceChange(
              cecClientProcess,
              isAudioDeviceOn,
              currentAppState
            );
          }

          return onRemoteControlKeyup(
            /** @type CecTransmission */ data,
            currentAppState
          );

        // if the event comes from an unknown source
        default:
          // then no-op
          return { ...currentAppState };
      }
    },
    /**
     * @desc the application state placeholder
     * @type AppState
     */
    undefined
  )
);

const appStateChange$ =
  /** @type {Observable<AppState>} */ currentAppState$.pipe(
    distinctUntilChanged((currentAppState, nextAppState) =>
      isAppStateChanged(cecClientProcess, currentAppState, nextAppState)
    )
  );

const audioDeviceRequestDisplayName$ =
  /** @type {Observable<CecClientEvent>} */ cecClientEvent$.pipe(
    filter(
      (cecClientEvent) =>
        cecClientEvent &&
        audioDeviceRequestDisplayNameRegExp.test(cecClientEvent.data)
    )
  );

const initialAudioDevicePowerAndSubsequentPowerOn$ =
  /** @type {Observable<void>} */ concat(
    isAudioDeviceOn$,
    audioDeviceRequestDisplayName$
  ).pipe(map(() => undefined));

/**
 * @desc OnInit - Subscriptions
 */
combineLatest(appStateChange$, initialAudioDevicePowerAndSubsequentPowerOn$)
  .pipe(takeUntil(destroy$))
  .subscribe(([appState]) => displayAppState(cecClientProcess, appState)); // update OSD according to application state

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
