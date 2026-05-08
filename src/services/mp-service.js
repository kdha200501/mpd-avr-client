const { getInstance: getMpClient } = require('../clients/mp-client');

const MpService = function () {
  return ((mpClient) => {
    const update = () => mpClient.sendMpCommand('update');

    const pause = () => mpClient.sendMpCommand('pause 1');

    /**
     * Play a particular playlist
     * @param {string} playlist The playlist
     * @returns {Promise<MpStatus>} A promise of sending the commands
     */
    const playPlaylist = (playlist) =>
      mpClient.sendMpCommand('clear', `load "${playlist}"`, 'play');

    const resume = () => mpClient.sendMpCommand('pause 0');

    const stop = () => mpClient.sendMpCommand('stop'); // note, 'stop' wipes the playback progress within the playlist

    const nextSong = () => mpClient.sendMpCommand('next');

    const previousSong = () => mpClient.sendMpCommand('previous');

    /**
     * Set the repeat mode
     * @param {'0'|'1'} repeat Whether to turn on repeat
     * @returns {Promise<MpStatus>} A promise of sending the command
     */
    const setRepeat = (repeat) => mpClient.sendMpCommand(`repeat ${repeat}`);

    /**
     * Set the random mode
     * @param {'0'|'1'} random Whether to turn on random
     * @returns {Promise<MpStatus>} A promise of sending the command
     */
    const setRandom = (random) => mpClient.sendMpCommand(`random ${random}`);

    return {
      update,
      pause,
      playPlaylist,
      resume,
      stop,
      nextSong,
      previousSong,
      setRepeat,
      setRandom,
    };
  })(getMpClient());
};

module.exports = MpService;
