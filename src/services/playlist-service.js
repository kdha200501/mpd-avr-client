const { readdir, unlink, writeFile, readFile } = require('fs');
const { stat } = require('fs');
const { join, extname, basename } = require('path');
const { from, concat, defer } = require('rxjs');
const {
  take,
  takeLast,
  share,
  switchMap,
  concatMap,
  withLatestFrom,
  scan,
  filter,
} = require('rxjs/operators');
const {
  mpdConfPath,
  playlistFilesBasePathSettingRegExp,
  playlistFoldersBasePathSettingRegExp,
} = require('../../const');

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

module.exports = PlaylistService;
