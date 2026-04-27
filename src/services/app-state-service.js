const { playOrPauseRegExp } = require('../../const');

const AppStateService = function () {
  return (() => {
    /**
     * Create AppState object
     * @param {AvrPowerStatus} avrPowerStatus The AVR power status
     * @param {MpStatus} mpStatus The MP status
     * @param {string[]} playlists The list of playlist names
     * @returns {AppState} AppState object
     */
    const createAppState = (avrPowerStatus, mpStatus, playlists) => {
      const [isAudioDeviceOn] = avrPowerStatus;
      const { state, song, playlistlength, elapsed, duration, repeat, random } =
        mpStatus;
      const showPlaylist = !playOrPauseRegExp.test(state);

      return /** @type AppState */ {
        isAudioDeviceOn,
        showPlaylist,
        playlistIdx: 0,
        playlists: /** @type string[] */ [...playlists],
        state,
        song,
        playlistlength,
        elapsed,
        duration,
        repeat,
        random,
      };
    };

    /**
     * Compare the current and the next application state to determine whether there is a change of state
     * @param {AppState} currentAppState The current application state
     * @param {AppState} nextAppState The next application state
     * @returns {boolean} Whether the application state is considered as changed
     */
    const isAppStateChanged = (currentAppState, nextAppState) => {
      if (currentAppState.isAudioDeviceOn !== nextAppState.isAudioDeviceOn) {
        return false;
      }

      if (currentAppState.showPlaylist !== nextAppState.showPlaylist) {
        return false;
      }

      const { showPlaylist } = currentAppState;

      if (showPlaylist) {
        return currentAppState.playlistIdx === nextAppState.playlistIdx;
      }

      return (
        currentAppState.state === nextAppState.state &&
        currentAppState.song === nextAppState.song &&
        currentAppState.playlistlength === nextAppState.playlistlength &&
        currentAppState.elapsed === nextAppState.elapsed &&
        currentAppState.duration === nextAppState.duration &&
        currentAppState.repeat === nextAppState.repeat &&
        currentAppState.random === nextAppState.random
      );
    };

    return { createAppState, isAppStateChanged };
  })();
};

module.exports = AppStateService;
