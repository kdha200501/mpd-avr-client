const { readdir, unlink, writeFile, readFile, stat } = require('fs');
const { join, extname, basename } = require('path');
const { connect } = require('net');
const { request } = require('http');
const {
  of,
  from,
  concat,
  defer,
  forkJoin,
  throwError,
  Observable,
  Subject,
} = require('rxjs');
const {
  take,
  takeLast,
  share,
  shareReplay,
  switchMap,
  concatMap,
  withLatestFrom,
  scan,
  filter,
  map,
  catchError,
  delay,
} = require('rxjs/operators');

const {
  mpdConfPath,
  mpdHost,
  mpdPortFallback,
  avrRequestDisplayNameRegExp,
  avrTurnOnRegExp,
  avrStandByRegExp,
  avrIsOnRegExp,
  avrIsStandByRegExp,
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
  blueFunctionKeyupRegExp,
  volumeStatusRegExp,
  mpdPortSettingRegExp,
  playlistFoldersBasePathSettingRegExp,
  playlistFilesBasePathSettingRegExp,
  playOrPauseRegExp,
  playRegExp,
  stopRegExp,
  pauseRegExp,
  tvLaunchProfileTypeTvTypeMap,
} = require('./const');

const MpClient = function (_mpClientProcess) {
  return ((mpClientProcess) => {
    const mpClientEvent$ =
      /** @type Observable<MpClientEvent> */ new Observable((subscriber) => {
        const source = 'mpClient';
        const onData = () =>
          new MpService()
            .getStatus()
            .then((data) =>
              subscriber.next({
                source,
                data,
              })
            )
            .catch((error) =>
              subscriber.next({
                source,
                data: error,
              })
            );
        const onClose = (exitCode) => {
          console.log(`mpc exited with code ${exitCode}\n`);

          if (exitCode === 0) {
            return subscriber.complete();
          }

          subscriber.error(exitCode);
        };
        const onUnsubscribe = () => {};

        // emit next event
        mpClientProcess.stdout.on('data', onData);
        mpClientProcess.stderr.on('data', onData);

        // emit complete and error event
        mpClientProcess.on('close', onClose);

        return onUnsubscribe;
      }).pipe(share());

    const publisher = () => mpClientEvent$;

    return { publisher };
  })(_mpClientProcess);
};

const CecClient = function (_cecClientProcess) {
  return ((cecClientProcess) => {
    const cecClientEvent$ =
      /** @type Observable<CecClientEvent>*/ new Observable((subscriber) => {
        const source = 'cecClient';
        const onData = (data) =>
          subscriber.next({
            source,
            data,
          });
        const onClose = (exitCode) => {
          console.log(`cec-client exited with code ${exitCode}\n`);

          if (exitCode === 0) {
            return subscriber.complete();
          }

          subscriber.error(exitCode);
        };
        const onUnsubscribe = () => {};

        // emit next event
        cecClientProcess.stdout.on('data', onData);
        cecClientProcess.stderr.on('data', onData);

        // emit complete and error event
        cecClientProcess.on('close', onClose);

        return onUnsubscribe;
      }).pipe(share());

    const publisher = () => cecClientEvent$;

    return { publisher };
  })(_cecClientProcess);
};

const HttpClient = function () {
  return (() => {
    /**
     * Make an HTTP POST call
     * @param {string} hostname The hostname
     * @param {string} path The path
     * @param {HttpObject} payload The POST request payload
     * @param {HttpObject} [headerOverrides] Optionally override headers
     * @returns {Promise<HttpObject>} A promise of the API response
     */
    const post = (hostname, path, payload, headerOverrides = {}) =>
      new Promise((resolve, reject) => {
        let /** @type OutgoingHttpHeaders */ outgoingHttpHeaders = {};

        const payloadString = JSON.stringify(payload);
        outgoingHttpHeaders['Content-Type'] = 'application/json';
        outgoingHttpHeaders['Content-Length'] =
          Buffer.byteLength(payloadString);

        let /** @type RequestOptions */ requestOptions = {};
        requestOptions.hostname = hostname;
        requestOptions.port = 80;
        requestOptions.path = path;
        requestOptions.method = 'POST';
        requestOptions.headers = { ...outgoingHttpHeaders, ...headerOverrides };

        const chunks = [];

        const clientRequest = request(requestOptions, (incomingMessage) => {
          incomingMessage.on('data', (data) => chunks.push(data));

          // upon response end
          incomingMessage.on('end', () => {
            try {
              resolve(JSON.parse(chunks.join('')));
            } catch (error) {
              reject(error);
            }
          });
        });

        clientRequest.on('error', reject);

        clientRequest.write(payloadString);

        // upon request end
        clientRequest.end();
      });

    return { post };
  })();
};

const AvrService = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const { osdMaxLength, audioVolumePreset } =
      /** @type AppConfig */ appConfig;

    const convertOsdToHex = (message) =>
      [...message.padEnd(osdMaxLength, ' ')]
        .slice(0, osdMaxLength)
        .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(':');

    /**
     * Run a CEC command
     * @param {string} command A CEC command
     * @returns {void} No output
     */
    const runCommand = (command) => void cecClientProcess.stdin.write(command);

    const requestPowerStatus = () => runCommand('pow 5');

    /**
     * Display a message on the AVR OSD
     * @param {string} message A message
     * @returns {void} No output
     */
    const updateOsd = (message) =>
      runCommand(`tx 15:47:${convertOsdToHex(message)}`);

    const increaseGainByHalfDecibel = () => runCommand('volup');

    const decreaseGainByHalfDecibel = () => runCommand('voldown');

    const requestAudioVolume = () => runCommand('tx 15:71');

    const setActiveSource = () => runCommand('as');

    /**
     * Decode the AVR power status from a CEC Client Event
     * @param {CecClientEvent} cecClientEvent A CEC Client Event
     * @returns {AvrPowerStatus} The AVR power status
     */
    const decodeAvrPowerStatus = (cecClientEvent) => {
      const { data: cecTransmission } = cecClientEvent;

      if (avrIsOnRegExp.test(cecTransmission)) {
        return [true];
      }

      if (avrIsStandByRegExp.test(cecTransmission)) {
        return [false];
      }

      if (avrTurnOnRegExp.test(cecTransmission)) {
        return [true];
      }

      if (avrStandByRegExp.test(cecTransmission)) {
        return [false];
      }

      return [undefined];
    };

    /**
     * Determine whether an AVR Power Status is valid
     * @param {AvrPowerStatus} avrPowerStatus An AVR Power Status
     * @returns {boolean} the validity of an AVR Power Status
     */
    const isAvrPowerStatusValid = ([isAudioDeviceOn]) =>
      isAudioDeviceOn !== undefined;

    /**
     * Decode the AVR audio volume status from CEC Client Event
     * @param {CecClientEvent} cecClientEvent A CEC Client Event
     * @returns {AvrVolumeStatus} The audio mute and volume in hex
     */
    const decodeAvrVolumeStatus = (cecClientEvent) => {
      const { data: cecTransmission } = cecClientEvent;

      if (!volumeStatusRegExp.test(cecTransmission)) {
        return [undefined];
      }

      const [_, __, ___, volumeInHex] = cecTransmission
        .toString()
        .match(volumeStatusRegExp);
      return [volumeInHex.replace(/:/g, '')];
    };

    /**
     * Determine whether a cec-client event is caused by the AVR requesting the host's name
     * @param {CecClientEvent} cecClientEvent A cec-client event
     * @returns {boolean} whether a cec-client event is caused by AVR requesting the host's name
     */
    const isAvrRequestDisplayName = (cecClientEvent) => {
      if (!cecClientEvent) {
        return false;
      }

      const { data: cecTransmission } = cecClientEvent;
      return avrRequestDisplayNameRegExp.test(cecTransmission);
    };

    /**
     * Adjust the AVR audio volume
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR volume status
     * @param {number} [audioVolumeOverride] Optionally override the audio volume preset
     * @returns {Observable<void>} An observable of no output
     */
    const adjustAudioVolume = (
      [avrMuteAndVolumeInHex],
      audioVolumeOverride = audioVolumePreset
    ) => {
      let { length } = avrMuteAndVolumeInHex;
      const muteStatusMaskOverflow = 2 ** ((length / 2) * 8); // 2 ^ (number of bits)
      const muteStatusMask = muteStatusMaskOverflow / 2; // the left-most bit is the mute status
      const volumeStatusMask = muteStatusMask - 1; // invert the mask to get a mask for the remainder bits

      const audioVolumeInDecimal =
        parseInt(avrMuteAndVolumeInHex, 16) & volumeStatusMask;

      const vector = Math.floor(audioVolumeOverride - audioVolumeInDecimal);
      const sign = Math.sign(vector);
      length = Math.abs(vector) * 2; // note, gain can be adjusted 0.5 Decibel at a time

      /**
       * @desc Unfortunately, there is no way to set volume to a particular value using CEC, as a result, audio volume is adjusted one unit at a time
       */
      return from(Array.from({ length }).map(() => Math.max(sign, 0))).pipe(
        concatMap(
          (increaseVolume) =>
            new Promise((resolve) => {
              increaseVolume
                ? increaseGainByHalfDecibel()
                : decreaseGainByHalfDecibel();
              /**
               * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
               */
              setTimeout(resolve, 500);
            })
        ),
        takeLast(1)
      );
    };

    /**
     * Determine whether an AVR Volume Status is valid
     * @param {AvrVolumeStatus} avrPowerStatus An AVR Volume Status
     * @returns {boolean} the validity of an AVR Volume Status
     */
    const isAvrVolumeStatsValid = ([avrMuteAndVolumeInHex]) =>
      avrMuteAndVolumeInHex !== undefined;

    return {
      runCommand,
      requestPowerStatus,
      updateOsd,
      increaseGainByHalfDecibel,
      decreaseGainByHalfDecibel,
      requestAudioVolume,
      setActiveSource,
      decodeAvrPowerStatus,
      isAvrPowerStatusValid,
      decodeAvrVolumeStatus,
      isAvrVolumeStatsValid,
      isAvrRequestDisplayName,
      adjustAudioVolume,
    };
  })(_appConfig, _cecClientProcess);
};

const PlaylistService = function () {
  return (() => {
    const ls = (path) =>
      new Promise((resolve, reject) =>
        readdir(path, { withFileTypes: true }, (err, dirents) =>
          err ? reject(err) : resolve(dirents)
        )
      );

    const rm = (path) =>
      new Promise((resolve) => unlink(path, () => resolve()));

    const redirect = (data, path) =>
      new Promise((resolve, reject) =>
        writeFile(path, data, { encoding: 'utf8' }, (err) =>
          err ? reject(err) : resolve()
        )
      );

    const getFileName = (directory, dirent) =>
      new Promise((resolve) => {
        if (dirent.isDirectory()) {
          return resolve();
        }

        const { name } = dirent;

        if (dirent.isFile()) {
          return resolve(name);
        }

        const filePath = join(directory, name);

        if (dirent.isSymbolicLink()) {
          stat(filePath, (err, stats) => {
            if (err) {
              return resolve();
            }

            resolve(stats.isFile() ? name : undefined);
          });

          return;
        }

        resolve();
      });

    /**
     * Index song files within a playlist folder
     * @param {string} playlistFolderPath The path to a folder containing song files
     * @returns {Promise<string[]>} a list of song file paths relative to music_directory
     */
    const indexPlaylistFolder = (playlistFolderPath) => {
      const playlistFolderName = basename(playlistFolderPath);

      return defer(() => ls(playlistFolderPath))
        .pipe(
          switchMap(from), // emit the songFiles sequentially
          concatMap((dirent) => getFileName(playlistFolderPath, dirent)), // inspect the songFiles sequentially
          scan(
            (acc, fileName) =>
              fileName ? [...acc, join(playlistFolderName, fileName)] : acc,
            []
          ),
          takeLast(1)
        )
        .toPromise();
    };

    /**
     * Get the playlist_directory value configured for MPD
     * @returns {Promise<string>} A promise of the playlist_directory value
     */
    const getPlaylistFilesBasePath = () =>
      new Promise((resolve, reject) => {
        readFile(mpdConfPath, (err, data) => {
          if (err) {
            return reject(err);
          }

          const dataLines = data.toString().split('\n');

          for (const dataLine of dataLines) {
            if (playlistFilesBasePathSettingRegExp.test(dataLine)) {
              const [_, path] = dataLine.match(
                playlistFilesBasePathSettingRegExp
              );
              return resolve(path);
            }
          }

          resolve(null);
        });
      });

    /**
     * Get the music_directory value configured for MPD
     * @returns {Promise<string>} A promise of the music_directory value
     */
    const getPlaylistFoldersBasePath = () =>
      new Promise((resolve, reject) => {
        readFile(mpdConfPath, (err, data) => {
          if (err) {
            return reject(err);
          }

          const dataLines = data.toString().split('\n');

          for (const dataLine of dataLines) {
            if (playlistFoldersBasePathSettingRegExp.test(dataLine)) {
              const [_, path] = dataLine.match(
                playlistFoldersBasePathSettingRegExp
              );
              return resolve(path);
            }
          }

          resolve(null);
        });
      });

    /**
     * Update the playlist_directory to mirror folders found in music_directory
     * @returns {Promise<string[]>} The list of playlists
     */
    const updatePlaylists = () => {
      const playlistFilesBasePath$ = defer(() =>
        getPlaylistFilesBasePath()
      ).pipe(share());

      const playlistFilePaths$ = playlistFilesBasePath$.pipe(
        switchMap((playlistFilesBasePath) =>
          ls(playlistFilesBasePath).then((dirents) =>
            dirents
              .filter(
                (dirent) =>
                  dirent.isFile() && /\.m3u$/i.test(extname(dirent.name))
              )
              .map(({ name }) => join(playlistFilesBasePath, name))
          )
        ),
        take(1)
      );

      const removePlaylistFiles$ = playlistFilePaths$.pipe(
        switchMap(from), // emit the playlistFilePaths sequentially
        concatMap(rm), // remove the playlistFilePaths sequentially
        takeLast(1)
      );

      const playlistFoldersBasePath$ = defer(() =>
        getPlaylistFoldersBasePath()
      ).pipe(share());

      const playlistFolders$ = playlistFoldersBasePath$.pipe(
        switchMap((playlistFoldersBasePath) =>
          ls(playlistFoldersBasePath).then((dirents) =>
            dirents.filter((dirent) => dirent.isDirectory())
          )
        ),
        take(1)
      );

      return concat(removePlaylistFiles$, playlistFolders$)
        .pipe(
          filter(Boolean),
          switchMap(from), // emit the playlistFolderPaths sequentially
          withLatestFrom(playlistFoldersBasePath$, playlistFilesBasePath$),
          concatMap(
            ([dirent, playlistFoldersBasePath, playlistFilesBasePath]) => {
              const { name } = dirent;
              const playlistFolderPath = join(playlistFoldersBasePath, name);
              const playlistFilePath = join(
                playlistFilesBasePath,
                `${name}.m3u`
              );

              return indexPlaylistFolder(playlistFolderPath)
                .then((relativePaths) =>
                  redirect(relativePaths.join('\n'), playlistFilePath)
                )
                .then(() => name);
            }
          ), // index the playlistFolderPaths sequentially
          scan((acc, playlistFileName) => [...acc, playlistFileName], []),
          takeLast(1)
        )
        .toPromise();
    };

    return { updatePlaylists };
  })();
};

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
        let connectReturnCode;

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

const AvrPowerStatusReducer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const avrService = new AvrService(appConfig, cecClientProcess);

    return (acc, _cecClientEvent) => {
      const { length } = /** @type AvrPowerStatus */ acc;
      const cecClientEvent = /** @type CecClientEvent */ _cecClientEvent;

      // if the request for AVR power status has been made
      if (length) {
        // then deduce the AVR power statue from transmissions received
        return avrService.decodeAvrPowerStatus(cecClientEvent);
      }

      // if the request for AVR power status has not been made, and
      // if the AVR is reaching out to identify the host
      if (avrService.isAvrRequestDisplayName(cecClientEvent)) {
        // then make a request for AVR power status
        /**
         * @desc when the host jumps on the HDMI bus, the audio device reaches out to the host and asks for identification
         */
        avrService.requestPowerStatus();
        return [undefined];
      }

      // if the request for AVR power status has not been made, and
      // if the AVR is not reaching out to identify the host,
      // then no-op
      return acc;
    };
  })(_appConfig, _cecClientProcess);
};

const AvrWakeUpVolumeStatusReducer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const avrService = new AvrService(appConfig, cecClientProcess);

    return (acc, cecClientEvent) => {
      const [isAudioDeviceOn] = avrService.decodeAvrPowerStatus(
        /** @type {CecClientEvent} */ cecClientEvent
      );

      // if the CEC transmission is regarding audio turning off (i.e. the AVR goes to stand-by mode)
      if (isAudioDeviceOn === false) {
        // then reset the reducer
        return [];
      }

      // if the CEC transmission is not regarding audio turning off, and
      // if the CEC transmission is regarding audio turning on
      if (isAudioDeviceOn) {
        // then request audio volume status
        /**
         * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
         */
        setTimeout(() => avrService.requestAudioVolume(), 500);
        return [undefined];
      }

      const { length } = /** @type AvrVolumeStatus */ acc;

      // if the CEC transmission is not regarding audio turning off, and
      // if the CEC transmission is not regarding audio turning on, and
      // if a request for the audio volume status was made
      if (length) {
        // then decode the CEC transmission
        return avrService.decodeAvrVolumeStatus(cecClientEvent);
      }

      // if the CEC transmission is not regarding audio turning off, and
      // if the CEC transmission is not regarding audio turning on, and
      // if a request for the audio volume status was not made,
      // then no-op
      return acc;
    };
  })(_appConfig, _cecClientProcess);
};

const AvrAudioSourceSwitchReducer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const { handOverAudioToTvCecCommand, audioVolumePresetForTv } =
      /** @type AppConfig */ appConfig;

    const avrService = new AvrService(appConfig, cecClientProcess);
    const mpService = new MpService();
    const tvLaunchService = new TvLaunchService(appConfig);

    /**
     * Initiate the audio source switch sequence by requesting the ARR audio volume
     * @param {AppState} appState The current App State
     * @param {CecClientEvent} cecClientEvent The received CEC Client Event
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} The AVR Volume Status and the MP Status State Transition
     */
    const initiateAudioSourceSwitch = (
      { isAudioDeviceOn },
      { data: cecTransmission }
    ) => {
      // if the AVR is in standby mode
      if (!isAudioDeviceOn) {
        // then reset the reducer
        return [[], [undefined, undefined]];
      }

      // if the AVR is not in standby mode, and
      // if the CEC transmission is regarding audio source switching
      if (blueFunctionKeyupRegExp.test(cecTransmission)) {
        // then ask AVR for audio volume (to initiate the audio source switching process)
        avrService.requestAudioVolume();
        return [[undefined], [undefined, undefined]];
      }

      // if the AVR is not in standby mode, and
      // if the CEC transmission is not regarding audio source switching,
      // then reset the reducer
      return [[], [undefined, undefined]];
    };

    /**
     * Switch audio source
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR Audio Status
     * @returns {void} No output
     */
    const switchingAudioSource = (avrVolumeStatus) => {
      avrService.runCommand(handOverAudioToTvCecCommand);

      if (tvLaunchService.isEnabled()) {
        tvLaunchService.wakeAndLaunchApp().subscribe();
      }

      if (audioVolumePresetForTv !== undefined) {
        of(audioVolumePresetForTv)
          .pipe(
            /**
             * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
             */
            delay(500),
            switchMap(() =>
              avrService.adjustAudioVolume(
                avrVolumeStatus,
                audioVolumePresetForTv
              )
            ),
            take(1)
          )
          .subscribe();
      }
    };

    /**
     * @desc The aim of this reducer is to switch audio source to a Smart TV which is connected to a non-HDMI audio input (on the AVR).
     *       The following objectives are listed chronologically, and they are executed sequentially to avoid timing issues
     *         - request AVR audio volume
     *         - request MP playback pause
     *         - request AVR audio source switch, request Smart TV to wake and launch app
     *         - request AVR audio volume adjustment
     */

    return (acc, [event, appState]) => {
      const [avrVolumeStatus, [fromMpStatusState, toMpStatusState]] =
        /** @type {[AvrVolumeStatus, MpStatusStateTransition]} */ acc;
      const { source } = /** @type {CecClientEvent|MpClientEvent} */ event;

      switch (source) {
        case 'cecClient':
          const cecClientEvent = /** @type CecClientEvent */ event;
          const [isAudioDeviceOn] =
            avrService.decodeAvrPowerStatus(cecClientEvent);

          // if the CEC transmission is regarding audio turning off (i.e. the AVR goes to stand-by mode)
          if (isAudioDeviceOn === false) {
            // then reset the reducer and request the TV to go to standby
            tvLaunchService.isEnabled() &&
              tvLaunchService.standBy().subscribe();
            return [[], [undefined, undefined]];
          }

          // if the CEC transmission is not regarding audio turning off, and
          // if the reducer is waiting for MP to respond to playback pause request
          if (fromMpStatusState && !toMpStatusState) {
            // then wait for MP to confirm its next state, see case 'mpClient'
            return acc;
          }

          // if the CEC transmission is not regarding audio turning off, and
          // if the reducer is not waiting for MP to respond to playback pause request, and
          // if the reducer is not waiting for the AVR to respond to audio volume request
          if (
            !avrVolumeStatus.length ||
            avrService.isAvrVolumeStatsValid(avrVolumeStatus)
          ) {
            // then initiate the audio switch sequence
            return initiateAudioSourceSwitch(appState, cecClientEvent);
          }

          const _avrVolumeStatus =
            avrService.decodeAvrVolumeStatus(cecClientEvent);

          // if the CEC transmission is not regarding audio turning off, and
          // if the reducer is not waiting for MP to respond to playback pause request, and
          // if the reducer is waiting for the AVR to respond to audio volume request, and
          // if the CEC transmission is not regarding AVR responding to audio volume request
          if (!avrService.isAvrVolumeStatsValid(_avrVolumeStatus)) {
            // then no-op
            return acc;
          }

          const { state } = /** @type AppState */ appState;

          // if the CEC transmission is not regarding audio turning off, and
          // if the reducer is not waiting for MP to respond to playback pause request, and
          // if the reducer is waiting for the AVR to respond to audio volume request, and
          // if the CEC transmission is regarding AVR responding to audio volume request, and
          // if MP is playing
          if (playRegExp.test(state)) {
            // then ask MP to pause
            avrService.updateOsd('pause');
            /**
             * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
             */
            setTimeout(() => mpService.pause(), 500);
            return [_avrVolumeStatus, [state, undefined]];
          }

          // if the CEC transmission is not regarding audio turning off, and
          // if the reducer is not waiting for MP to respond to playback pause request, and
          // if the reducer is waiting for the AVR to respond to audio volume request, and
          // if the CEC transmission is regarding AVR responding to audio volume request, and
          // if MP is not playing,
          // then do not ask MP to pause and switch audio source directly
          switchingAudioSource(_avrVolumeStatus);
          return [_avrVolumeStatus, [state, state]];

        case 'mpClient':
          // if the reducer is not waiting for MP to respond to playback pause request
          if (!fromMpStatusState || toMpStatusState) {
            // then reset the reducer
            return [[], [undefined, undefined]];
          }

          const { data: mpStatus } = /** @type MpClientEvent */ event;

          // if the reducer is waiting for MP to respond to playback pause request, and
          // if MP decides to keep playing
          if (playRegExp.test(mpStatus.state)) {
            // then reset the reducer
            return [[], [undefined, undefined]];
          }

          // if the reducer is waiting for MP to respond to playback pause request, and
          // if MP confirms playback is paused,
          // then switch the audio source
          /**
           * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
           */
          setTimeout(() => switchingAudioSource(avrVolumeStatus), 500);
          return [avrVolumeStatus, [fromMpStatusState, mpStatus.state]];

        default:
          return [[], [undefined, undefined]];
      }
    };
  })(_appConfig, _cecClientProcess);
};

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
        currentAppState.repeat === nextAppState.repeat &&
        currentAppState.random === nextAppState.random
      );
    };

    return { createAppState, isAppStateChanged };
  })();
};

const AppStateReducer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const avrService = new AvrService(appConfig, cecClientProcess);
    const mpService = new MpService();

    /**
     * Reaction to AVR power status change
     * @param {ChildProcessWithoutNullStreams} cecClientProcess The API service for the AVR
     * @param {boolean} isAudioDeviceOn Whether the AVR is ON
     * @param {AppState} currentAppState The current application state
     * @returns {AppState} The next application state
     */
    const onAvrPowerStatusChange = (
      cecClientProcess,
      isAudioDeviceOn,
      currentAppState
    ) => {
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

    return (currentAppState, event) => {
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
            return onAvrPowerStatusChange(
              cecClientProcess,
              isAudioDeviceOn,
              appState
            );
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
    };
  })(_appConfig, _cecClientProcess);
};

const AppStateRenderer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const avrService = new AvrService(appConfig, cecClientProcess);

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
  })(_appConfig, _cecClientProcess);
};

const PromptRenderer = function (_appConfig, _cecClientProcess) {
  return ((appConfig, cecClientProcess) => {
    const avrService = new AvrService(appConfig, cecClientProcess);

    return ([cecClientEvent, appState]) => {
      const { data: cecTransmission } =
        /** @type CecClientEvent */ cecClientEvent;
      const { state, repeat, random } = /** @type AppState */ appState;
      let /** @type string */ message;

      /**
       * @desc play action
       */
      if (playKeyupRegExp.test(cecTransmission) && !playRegExp.test(state)) {
        message = 'play';
        return avrService.updateOsd(message);
      }

      /**
       * @desc pause action
       */
      if (pauseKeyupRegExp.test(cecTransmission) && !pauseRegExp.test(state)) {
        message = 'pause';
        return avrService.updateOsd(message);
      }

      /**
       * @desc toggle repeat action
       */
      if (redFunctionKeyupRegExp.test(cecTransmission)) {
        message = `repeat: ${repeat === '1' ? 'OFF' : 'ON'}`;
        return avrService.updateOsd(message);
      }

      /**
       * @desc toggle random action
       */
      if (greenFunctionKeyupRegExp.test(cecTransmission)) {
        message = `random: ${random === '1' ? 'OFF' : 'ON'}`;
        return avrService.updateOsd(message);
      }
    };
  })(_appConfig, _cecClientProcess);
};

const AppTerminator = function (_cecClientProcess, _mpClientProcess) {
  return ((cecClientProcess, mpClientProcess) => {
    const destroy$ = new Subject();

    const publisher = () => destroy$;

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

    return { publisher, onExit };
  })(_cecClientProcess, _mpClientProcess);
};

const TvLaunchService = function (_appConfig) {
  return ((appConfig) => {
    let /** @type string */ tvLaunchProfilePath;
    let /** @type TvType */ tvType;
    for (const tvLaunchProfileType of tvLaunchProfileTypeTvTypeMap.keys()) {
      if (!appConfig[tvLaunchProfileType]) {
        continue;
      }

      tvLaunchProfilePath = appConfig[tvLaunchProfileType];
      tvType = tvLaunchProfileTypeTvTypeMap.get(tvLaunchProfileType);
    }

    const httpClient = new HttpClient();

    const braviaPayloadBase =
      /** @type {Pick<BraviaPayload, "version" | "id" | "params">} */ {
        version: '1.0',
        id: 1,
        params: [],
      };

    const tvLaunchProfile$ =
      /** @type Observable<TvLaunchProfile> */ new Observable((subscriber) => {
        readFile(tvLaunchProfilePath, (err, data) => {
          if (err) {
            return subscriber.error(err);
          }

          try {
            subscriber.next(JSON.parse(data.toString()));
            subscriber.complete();
          } catch (err) {
            subscriber.error(err);
            subscriber.complete();
          }
        });

        return () => {};
      }).pipe(shareReplay());

    const isEnabled = () => !!tvType;

    const getAppTitle = () =>
      tvLaunchProfile$.pipe(
        map(({ appTitle }) => appTitle),
        catchError(() => of({})),
        take(1)
      );

    const wake = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/system',
                {
                  ...braviaPayloadBase,
                  method: 'setPowerStatus',
                  params: [{ status: true }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const standBy = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/system',
                {
                  ...braviaPayloadBase,
                  method: 'setPowerStatus',
                  params: [{ status: false }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const listApps = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/appControl',
                {
                  ...braviaPayloadBase,
                  method: 'getApplicationList',
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const launchApp = (uri) =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/appControl',
                {
                  ...braviaPayloadBase,
                  method: 'setActiveApp',
                  params: [{ uri }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const wakeAndLaunchAppForBravia = () =>
      forkJoin(listApps(), getAppTitle()).pipe(
        switchMap(([braviaResponse, appTitle]) => {
          const { result, error } = /** @type BraviaResponse */ braviaResponse;

          // if the API call to the TV failed or the response contains error
          if (!result || error) {
            // then do not wake the TV
            return of({});
          }

          const [braviaApps] = /** @type [BraviaApp[]] */ result || [[]];

          const braviaAppMap = new Map(
            braviaApps.map((braviaApp) => [braviaApp.title, braviaApp])
          );

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is no specified app in the launch profile
          if (!appTitle) {
            // then wake the TV, only
            return wake();
          }

          const { uri } =
            /** @type BraviaApp */ braviaAppMap.get(appTitle) || {};

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is a specified app in the launch profile, and
          // if the specified app is not installed on the TV
          if (!uri) {
            // then wake the TV, only
            return wake();
          }

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is a specified app in the launch profile, and
          // if the specified app is installed on the TV,
          // then wake the TV and then launch the app
          return concat(wake(), launchApp(uri));
        }),
        takeLast(1)
      );

    const wakeAndLaunchApp = () => {
      switch (tvType) {
        case 'BRAVIA':
          return wakeAndLaunchAppForBravia();
        default:
          return throwError(null);
      }
    };

    return {
      isEnabled,
      wakeAndLaunchApp,
      standBy,
    };
  })(_appConfig);
};

module.exports = {
  CecClient,
  MpClient,
  AvrService,
  AvrPowerStatusReducer,
  AvrWakeUpVolumeStatusReducer,
  AvrAudioSourceSwitchReducer,
  PlaylistService,
  MpService,
  AppStateService,
  AppStateReducer,
  AppStateRenderer,
  PromptRenderer,
  AppTerminator,
};
