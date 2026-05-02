const { readFile } = require('fs');
const { connect } = require('net');
const { Observable } = require('rxjs');
const { shareReplay, switchMap, take } = require('rxjs/operators');

const {
  mpdConfPath,
  mpdHost,
  mpdPortFallback,
  mpdPortSettingRegExp,
} = require('../../const');

const MpService = function () {
  return (() => {
    const mpdPort$ = new Observable((subscriber) => {
      readFile(mpdConfPath, (err, data) => {
        if (err) {
          return subscriber.error(err);
        }

        const dataLines = data.toString().split('\n');

        for (const dataLine of dataLines) {
          if (mpdPortSettingRegExp.test(dataLine)) {
            const [_, port] = dataLine.match(mpdPortSettingRegExp);
            subscriber.next(port);
            subscriber.complete();
            return;
          }
        }

        subscriber.next(mpdPortFallback);
        subscriber.complete();
      });

      return () => {};
    }).pipe(shareReplay());

    /**
     * Establish a nc connection with MPD and send commands
     * @param {string} host The address to the MPD
     * @param {string} port The port MPD runs at
     * @param {string[]} commands The commands to be sent to MPD
     * @returns {Promise<MpStatus>} A promise of the music player status
     */
    const handShakeAndSendCommands = (host, port, commands) =>
      new Promise((resolve, reject) => {
        const socket = /** @type Socket */ connect({ host, port });
        socket.setTimeout(5000);
        let connectReturnCode;

        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('MPD connection timed out'));
        });

        socket.on('data', (data) => {
          let dataLines = data.toString().trim().split('\n');
          const [returnCode] = dataLines.splice(-1, 1);

          if (!/^OK\s*/i.test(returnCode)) {
            socket.end();
            reject(returnCode);
            return;
          }

          // if the success response corresponds to the command execution,
          // then conclude the connection
          if (connectReturnCode) {
            socket.end();
            dataLines = dataLines.map((dataLine) => {
              const [key, val] = dataLine.split(':');
              return ['"', key.trim(), '":"', val.trim(), '"'].join('');
            });
            dataLines = ['{', dataLines.join(','), '}'];
            try {
              resolve(JSON.parse(dataLines.join('')));
            } catch (ex) {
              reject(ex);
            }
            return;
          }

          connectReturnCode = returnCode;

          const commandSet = new Set([
            'command_list_begin',
            ...commands,
            'status',
            'command_list_end',
            '',
          ]);

          // if the success response corresponds to the connection initialization,
          // then send the commands
          socket.write([...commandSet].join('\n'));
        });

        socket.on('error', (err) => {
          socket.end();
          reject(err);
        });
      });

    /**
     * Send command to MPD through nc
     * @param {string|string[]} commands The commands
     * @returns {Promise<MpStatus>} A promise of the music player status
     */
    const sendMpCommand = (...commands) =>
      mpdPort$
        .pipe(
          switchMap((mpdPort) =>
            handShakeAndSendCommands(mpdHost, mpdPort, commands)
          ),
          take(1)
        )
        .toPromise();

    const getStatus = () => sendMpCommand('status');

    const update = () => sendMpCommand('update');

    const pause = () => sendMpCommand('pause 1');

    /**
     * Play a particular playlist
     * @param {string} playlist The playlist
     * @returns {Promise<MpStatus>} A promise of sending the commands
     */
    const playPlaylist = (playlist) =>
      sendMpCommand('clear', `load "${playlist}"`, 'play');

    const resume = () => sendMpCommand('pause 0');

    const stop = () => sendMpCommand('stop'); // note, 'stop' wipes the playback progress within the playlist

    const nextSong = () => sendMpCommand('next');

    const previousSong = () => sendMpCommand('previous');

    /**
     * Set the repeat mode
     * @param {'0'|'1'} repeat Whether to turn on repeat
     * @returns {Promise<MpStatus>} A promise of sending the command
     */
    const setRepeat = (repeat) => sendMpCommand(`repeat ${repeat}`);

    /**
     * Set the random mode
     * @param {'0'|'1'} random Whether to turn on random
     * @returns {Promise<MpStatus>} A promise of sending the command
     */
    const setRandom = (random) => sendMpCommand(`random ${random}`);

    return {
      getStatus,
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
  })();
};

module.exports = MpService;
