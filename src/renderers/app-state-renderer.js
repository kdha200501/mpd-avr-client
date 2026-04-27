const { playRegExp } = require('../../const');
const AvrService = require('../services/avr-service');

const AppStateRenderer = function (_appConfig) {
  return ((appConfig) => {
    const avrService = new AvrService(appConfig);

    const rightShiftString = (str, shift) => {
      const { length } = str;
      const idx = length - shift;
      return `${str.slice(idx)}${str.slice(0, idx)}`;
    };

    return (appState) => {
      const {
        showPlaylist,
        playlistIdx,
        playlists,
        state,
        song,
        playlistlength,
        elapsed,
        duration,
      } = /** @type AppState */ appState;
      let /** @type string */ message;

      // if the OSD is displaying the playlists
      if (showPlaylist) {
        // then print the current playlist
        message = playlists[playlistIdx];
        return avrService.updateOsd(message);
      }

      // if the OSD is displaying the player status, and
      // if the MP is playing
      if (playRegExp.test(state)) {
        // then print the song position in the playlist
        message = `[${song}/${playlistlength}]`;
        return avrService.updateOsd(message);
      }

      // if the OSD is displaying the player status, and
      // if the MP is paused,
      // then print the song progress
      const elapsedInSeconds = Number(elapsed);
      const durationInSeconds = Number(duration);
      const offset =
        durationInSeconds &&
        Math.floor((elapsedInSeconds / durationInSeconds) * 10);
      message = `>${Array.from({ length: 10 }).join('_')}`;
      message = `[${rightShiftString(message, offset)}]`;
      return avrService.updateOsd(message);
    };
  })(_appConfig);
};

module.exports = AppStateRenderer;
