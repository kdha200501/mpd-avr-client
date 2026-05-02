const {
  playOrPauseRegExp,
  stopRegExp,
  arrowUpKeyupRegExp,
  arrowDownKeyupRegExp,
  enterKeyupRegExp,
  returnKeyupRegExp,
  playKeyupRegExp,
  pauseKeyupRegExp,
  stopKeyupRegExp,
  nextKeyupRegExp,
  previousKeyupRegExp,
  redFunctionKeyupRegExp,
  greenFunctionKeyupRegExp,
} = require('../../const');
const AvrService = require('../services/avr-service');
const MpService = require('../services/mp-service');
const { getInstance: getMpClient } = require('../clients/mp-client');

const AppStateReducer = function (_appConfig) {
  return ((appConfig) => {
    const avrService = new AvrService(appConfig);
    const mpService = new MpService();

    /**
     * Reaction to AVR power status change
     * @param {boolean} isAudioDeviceOn Whether the AVR is ON
     * @param {AppState} currentAppState The current application state
     * @returns {AppState} The next application state
     */
    const onAvrPowerStatusChange = (isAudioDeviceOn, currentAppState) => {
      if (isAudioDeviceOn) {
        getMpClient().reset();
      }

      // if there is no change in the power status of the AVR
      if (isAudioDeviceOn === currentAppState.isAudioDeviceOn) {
        // then no-op
        /**
         * @desc Notes
         * - The `on 5` command causes the AVR to stop emitting standby events. This application will not turn on the AVR programmatically
         */
        return { ...currentAppState };
      }

      // if there is a change in the power status of the AVR, and
      // if the AVR turns on
      if (isAudioDeviceOn) {
        // then update the application state
        return {
          ...currentAppState,
          isAudioDeviceOn,
          showPlaylist: !playOrPauseRegExp.test(currentAppState.state),
        };
      }

      // if there is a change in the power status of the AVR, and
      // if the AVR turns off,
      // then reset application
      mpService.pause();
      /**
       * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
       */
      setTimeout(() => avrService.setActiveSource(), 500);
      return { ...currentAppState, isAudioDeviceOn, showPlaylist: true };
    };

    /**
     * Reaction to Mp status change
     * @param {MpStatus} mpStatus The new MP status
     * @param {AppState} currentAppState The current application state
     * @returns {AppState} The next application state
     */
    const onMpStateChange = (
      { state, song, playlistlength, elapsed, duration, repeat, random },
      currentAppState
    ) => {
      if (playOrPauseRegExp.test(state)) {
        return {
          ...currentAppState,
          showPlaylist: false,
          state,
          song,
          playlistlength,
          elapsed,
          duration,
          repeat,
          random,
        };
      }

      if (stopRegExp.test(state)) {
        return {
          ...currentAppState,
          showPlaylist: true,
          state,
          song,
          playlistlength,
          elapsed,
          duration,
          repeat,
          random,
        };
      }

      return { ...currentAppState };
    };

    /**
     * Reaction to AVR remote control event
     * @param {CecTransmission} cecTransmission The remote control event
     * @param {AppState} currentAppState The current application state
     * @returns {AppState} The next application state
     */
    const onRemoteControlKeyup = (cecTransmission, currentAppState) => {
      const { showPlaylist, playlists, playlistIdx } = currentAppState;

      // if the OSD is displaying the playlists
      if (showPlaylist) {
        // then handle playlist navigation
        if (!playlists.length) {
          return { ...currentAppState };
        }

        /**
         * @desc arrow up action
         */
        if (arrowUpKeyupRegExp.test(cecTransmission)) {
          return {
            ...currentAppState,
            playlistIdx:
              (playlists.length + playlistIdx - 1) % playlists.length,
          };
        }

        /**
         * @desc arrow down action
         */
        if (arrowDownKeyupRegExp.test(cecTransmission)) {
          return {
            ...currentAppState,
            playlistIdx:
              (playlists.length + playlistIdx + 1) % playlists.length,
          };
        }

        /**
         * @desc enter action
         */
        if (enterKeyupRegExp.test(cecTransmission)) {
          mpService.playPlaylist(playlists[playlistIdx]);
          return { ...currentAppState };
        }

        /**
         * @desc close playlist
         */
        if (returnKeyupRegExp.test(cecTransmission)) {
          return {
            ...currentAppState,
            showPlaylist: !playOrPauseRegExp.test(currentAppState.state),
          };
        }

        return { ...currentAppState };
      }

      // if the OSD is displaying the player status,
      // then handle player actions

      /**
       * @desc show playlist action
       */
      if (returnKeyupRegExp.test(cecTransmission)) {
        return { ...currentAppState, showPlaylist: true };
      }

      /**
       * @desc play action
       */
      if (playKeyupRegExp.test(cecTransmission)) {
        /**
         * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
         */
        setTimeout(() => void mpService.resume(), 500);
        return { ...currentAppState };
      }

      /**
       * @desc pause action
       */
      if (pauseKeyupRegExp.test(cecTransmission)) {
        /**
         * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
         */
        setTimeout(() => mpService.pause(), 500);
        return { ...currentAppState };
      }

      /**
       * @desc stop action
       */
      if (stopKeyupRegExp.test(cecTransmission)) {
        mpService.stop();
        return { ...currentAppState };
      }

      /**
       * @desc next song action
       */
      if (nextKeyupRegExp.test(cecTransmission)) {
        mpService.nextSong();
        return { ...currentAppState };
      }

      /**
       * @desc previous song action
       */
      if (previousKeyupRegExp.test(cecTransmission)) {
        mpService.previousSong();
        return { ...currentAppState };
      }

      /**
       * @desc toggle repeat action
       */
      if (redFunctionKeyupRegExp.test(cecTransmission)) {
        /**
         * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
         */
        setTimeout(
          () =>
            void mpService.setRepeat(
              currentAppState.repeat === '1' ? '0' : '1'
            ),
          500
        );
        return { ...currentAppState };
      }

      /**
       * @desc toggle random action
       */
      if (greenFunctionKeyupRegExp.test(cecTransmission)) {
        /**
         * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
         */
        setTimeout(
          () =>
            void mpService.setRandom(
              currentAppState.random === '1' ? '0' : '1'
            ),
          500
        );
        return { ...currentAppState };
      }

      return { ...currentAppState };
    };

    /**
     * @desc The entire application state
     */

    return [
      (currentAppState, event) => {
        if (!event) {
          return;
        }

        let /** @type AppState */ appState;

        // if handling the initial application state
        if (currentAppState === undefined) {
          // then initialize the application state
          appState = /** @type AppState */ event;
          return { ...appState };
        }

        appState = currentAppState;
        const { data, source } =
          /** @type {CecClientEvent|MpClientEvent} */ event;

        // if handling a subsequent actions or state change
        switch (source) {
          // then mutate the application state

          // if the event comes from the music player
          case 'mpClient':
            // then update the application state to sync up with the music player state
            const mpStatus = /** @type MpStatus */ data;
            return onMpStateChange(mpStatus, appState);

          // if the event comes from the CEC client
          case 'cecClient':
            // then update the application state according to the action
            const [isAudioDeviceOn] = avrService.decodeAvrPowerStatus(
              /** @type {CecClientEvent} */ event
            );

            if (isAudioDeviceOn !== undefined) {
              return onAvrPowerStatusChange(isAudioDeviceOn, appState);
            }

            if (!appState.isAudioDeviceOn) {
              return { ...appState };
            }

            return onRemoteControlKeyup(
              /** @type CecTransmission */ data,
              appState
            );

          // if the event comes from an unknown source
          default:
            // then no-op
            return { ...appState };
        }
      },
      undefined,
    ];
  })(_appConfig);
};

module.exports = AppStateReducer;
