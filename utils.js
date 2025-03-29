const { readdir, unlink, writeFile, readFile, stat } = require('fs');
const { connect } = require('net');
const { parse, join, extname, basename } = require('path');
const { from, concat, defer, Observable } = require('rxjs');
const {
  take,
  share,
  takeLast,
  concatMap,
  switchMap,
  withLatestFrom,
  scan,
  filter,
} = require('rxjs/operators');

const {
  audioDeviceTurnOnRegExp,
  audioDeviceStandByRegExp,
  audioDeviceIsOnRegExp,
  audioDeviceIsStandByRegExp,
  arrowUpKeyupRegExp,
  arrowDownKeyupRegExp,
  enterKeyupRegExp,
  returnKeyupRegExp,
  playKeyupRegExp,
  pauseKeyupRegExp,
  stopKeyupRegExp,
  nextKeyupRegExp,
  previousKeyupRegExp,
  playlistFoldersBasePathSettingRegExp,
  playlistFilesBasePathSettingRegExp,
  playOrPauseRegExp,
  stopRegExp,
} = require('./const');

const osdMaxLength = 14;
const { root } = parse(process.cwd());
const mpdConfPath = join(root, 'etc', 'mpd.conf');
const mpdHost = 'localhost';
const mpdPort = 6600;

const convertOsdToHex = (text) =>
  [...text.padEnd(osdMaxLength, ' ')]
    .slice(0, osdMaxLength)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(':');

const ls = (path) =>
  new Promise((resolve, reject) =>
    readdir(path, { withFileTypes: true }, (err, dirents) =>
      err ? reject(err) : resolve(dirents)
    )
  );

const rm = (path) => new Promise((resolve) => unlink(path, () => resolve()));

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
 * Send command to MPD through nc
 * @param {string|string[]} commands The commands
 * @returns {Promise<MpStatus>} A promise of the music player status
 */
const sendMpCommand = (...commands) =>
  new Promise((resolve, reject) => {
    const socket = connect({ host: mpdHost, port: mpdPort });
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
 * Update the AVR display
 * @param {ChildProcessWithoutNullStreams} cecClientProcess The API service for the AVR
 * @param {AppState} appState The current application state
 * @returns {number} An identifier for the timer
 */
const updateOsd = (
  cecClientProcess,
  { isAudioDeviceOn, state, showPlaylist, playlistIdx, playlists }
) => {
  /*
   * console.log(`
   *   =============
   *   = updateOsd =
   *   =============
   *   isAudioDeviceOn: ${isAudioDeviceOn}
   *   state: ${state}
   *   showPlaylist: ${showPlaylist}
   *   playlistIdx: ${playlistIdx}
   *   playlists.length: ${playlists.length}
   *   `);
   */
  if (showPlaylist) {
    return cecClientProcess.stdin.write(
      `tx 15:47:${convertOsdToHex(playlists[playlistIdx])}`
    );
  }

  cecClientProcess.stdin.write(`tx 15:47:${convertOsdToHex(state)}`);
};

/**
 * Decode a CEC transmission to determine whether the AVR is turned on
 * @param {CecTransmission} cecTransmission A CEC transmission
 * @returns {undefined|boolean} Whether the AVR is turned on
 */
const getIsAudioDeviceOn = (cecTransmission) => {
  if (audioDeviceIsOnRegExp.test(cecTransmission)) {
    return true;
  }

  if (audioDeviceIsStandByRegExp.test(cecTransmission)) {
    return false;
  }

  if (audioDeviceTurnOnRegExp.test(cecTransmission)) {
    return true;
  }

  if (audioDeviceStandByRegExp.test(cecTransmission)) {
    return false;
  }

  return undefined;
};

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
          const [_, path] = dataLine.match(playlistFilesBasePathSettingRegExp);
          return resolve(path);
        }
      }

      resolve(null);
    });
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
 * Update the playlist_directory to mirror folders found in music_directory
 * @returns {Promise<string[]>} The list of playlists
 */
const updatePlaylists = () => {
  const playlistFilesBasePath$ = defer(() => getPlaylistFilesBasePath()).pipe(
    share()
  );

  const playlistFilePaths$ = playlistFilesBasePath$.pipe(
    switchMap((playlistFilesBasePath) =>
      ls(playlistFilesBasePath).then((dirents) =>
        dirents
          .filter(
            (dirent) => dirent.isFile() && /\.m3u$/i.test(extname(dirent.name))
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
      concatMap(([dirent, playlistFoldersBasePath, playlistFilesBasePath]) => {
        const { name } = dirent;
        const playlistFolderPath = join(playlistFoldersBasePath, name);
        const playlistFilePath = join(playlistFilesBasePath, `${name}.m3u`);

        return indexPlaylistFolder(playlistFolderPath)
          .then((relativePaths) =>
            redirect(relativePaths.join('\n'), playlistFilePath)
          )
          .then(() => name);
      }), // index the playlistFolderPaths sequentially
      scan((acc, playlistFileName) => [...acc, playlistFileName], []),
      takeLast(1)
    )
    .toPromise();
};

/**
 * Reaction to AVR update
 * @param {ChildProcessWithoutNullStreams} cecClientProcess The API service for the AVR
 * @param {boolean} isAudioDeviceOn Whether the AVR is ON
 * @param {AppState} currentAppState The current application state
 * @returns {AppState} The next application state
 */
const onAudioDeviceChange = (
  cecClientProcess,
  isAudioDeviceOn,
  currentAppState
) => {
  if (isAudioDeviceOn === currentAppState.isAudioDeviceOn) {
    return { ...currentAppState };
  }

  if (isAudioDeviceOn) {
    return {
      ...currentAppState,
      isAudioDeviceOn,
      showPlaylist: !playOrPauseRegExp.test(currentAppState.state),
    };
  }

  void sendMpCommand('pause');
  cecClientProcess.stdin.write('as');

  return { ...currentAppState, isAudioDeviceOn };
};

/**
 * Reaction to AVR remote control event
 * @param {CecTransmission} cecTransmission The remote control event
 * @param {AppState} currentAppState The current application state
 * @returns {AppState} The next application state
 */
const onRemoteControlKeyup = (cecTransmission, currentAppState) => {
  const { showPlaylist, playlists, playlistIdx } = currentAppState;

  if (showPlaylist) {
    if (!playlists.length) {
      return { ...currentAppState };
    }

    // arrow up action
    if (arrowUpKeyupRegExp.test(cecTransmission)) {
      return {
        ...currentAppState,
        playlistIdx: (playlists.length + playlistIdx - 1) % playlists.length,
      };
    }

    // arrow down action
    if (arrowDownKeyupRegExp.test(cecTransmission)) {
      return {
        ...currentAppState,
        playlistIdx: (playlists.length + playlistIdx + 1) % playlists.length,
      };
    }

    // enter action
    if (enterKeyupRegExp.test(cecTransmission)) {
      void sendMpCommand('clear', `load "${playlists[playlistIdx]}"`, 'play');
      return { ...currentAppState };
    }

    return { ...currentAppState };
  }

  // show playlist action
  if (returnKeyupRegExp.test(cecTransmission)) {
    return { ...currentAppState, showPlaylist: true };
  }

  // play action
  if (playKeyupRegExp.test(cecTransmission)) {
    void sendMpCommand('play');
    return { ...currentAppState };
  }

  // pause action
  if (pauseKeyupRegExp.test(cecTransmission)) {
    void sendMpCommand('pause');
    return { ...currentAppState };
  }

  // stop action
  if (stopKeyupRegExp.test(cecTransmission)) {
    void sendMpCommand('stop');
    return { ...currentAppState };
  }

  // next song action
  if (nextKeyupRegExp.test(cecTransmission)) {
    void sendMpCommand('next');
    return { ...currentAppState };
  }

  // previous song action
  if (previousKeyupRegExp.test(cecTransmission)) {
    void sendMpCommand('previous');
    return { ...currentAppState };
  }

  return { ...currentAppState };
};

/**
 * Reaction to Mp status change
 * @param {MpStatus} mpStatus The new MP status
 * @param {AppState} currentAppState The current application state
 * @returns {AppState} The next application state
 */
const onMpStateChange = ({ state }, currentAppState) => {
  if (playOrPauseRegExp.test(state)) {
    return { ...currentAppState, state, showPlaylist: false };
  }

  if (stopRegExp.test(state)) {
    return { ...currentAppState, state, showPlaylist: true };
  }

  return { ...currentAppState };
};

/**
 * Compare the current and the next application state to determine whether there is a change of state
 * @param {ChildProcessWithoutNullStreams} cecClientProcess The API service for the AVR
 * @param {AppState} currentAppState The current application state
 * @param {AppState} nextAppState The next application state
 * @returns {boolean} Whether the application state is considered as changed
 */
const isAppStateChanged = (cecClientProcess, currentAppState, nextAppState) => {
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

  return currentAppState.state === nextAppState.state;
};

/**
 * Get a stream of music player status changes
 * @param {ChildProcessWithoutNullStreams} mpClientProcess The API service for the music player
 * @returns {Observable<MpClientEvent>} A stream of music player status changes
 */
const getMpClientEvent = (mpClientProcess) =>
  /** @type Observable<MpClientEvent> */ new Observable((subscriber) => {
    const source = 'mpClient';
    const onData = () =>
      sendMpCommand('status')
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
  });

/**
 * Get a stream of AVR status changes
 * @param {ChildProcessWithoutNullStreams} cecClientProcess The API service for the AVR
 * @returns {Observable<CecClientEvent>} A stream of AVR status changes
 */
const getCecClientEvent = (cecClientProcess) =>
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
  });

module.exports = {
  sendMpCommand,
  getIsAudioDeviceOn,
  updatePlaylists,
  onAudioDeviceChange,
  onRemoteControlKeyup,
  onMpStateChange,
  isAppStateChanged,
  getMpClientEvent,
  getCecClientEvent,
  updateOsd,
};
