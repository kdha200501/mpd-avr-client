const { readFile } = require('fs');
const { connect } = require('net');
const { spawn } = require('child_process');
const find = require('find-process');
const {
  Observable,
  Subject,
  timer,
  from,
  throwError,
  concat,
  of,
  EMPTY,
} = require('rxjs');
const {
  startWith,
  concatMap,
  first,
  takeUntil,
  ignoreElements,
  share,
  catchError,
  shareReplay,
  switchMap,
  take,
} = require('rxjs/operators');

const {
  mpdConfPath,
  mpdHost,
  mpdPortFallback,
  mpdPortSettingRegExp,
} = require('../const');

let instance;

const pollMpcProcess = () =>
  timer(0, 500).pipe(
    switchMap(() => from(find('name', 'mpc idleloop'))),
    switchMap((list, index) => {
      // if there is no existing mpc process
      if (!list.length) {
        // then skip polling
        return of(true);
      }

      // if there is existing mpc process, and
      // if the maximum number of poll has not been reached
      if (index < 5) {
        // then continue polling
        return EMPTY;
      }

      // if there is existing mpc process, and
      // if the maximum number of poll has been reached,
      // then give up on polling
      return throwError(
        () => new Error('OS_RESOURCE_LOCK: mpc failed to exit.')
      );
    }),
    first(),
    ignoreElements()
  );

const MpClient = function () {
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

    const resetProcess$ = new Subject();
    const killSignal$ = new Subject();

    const spawnMpc = () =>
      new Observable((subscriber) => {
        const source = 'mpClient';

        const onData = () =>
          sendMpCommand('status')
            .then((data) => subscriber.next({ source, data }))
            .catch((error) => subscriber.next({ source, data: error }));

        const mpClientProcess = spawn('mpc', ['idleloop']);
        console.log(`mpc process started with PID ${mpClientProcess.pid}`);

        mpClientProcess.stdout.on('data', onData);
        mpClientProcess.stderr.on('data', onData);

        return () => {
          console.log(`SIGKILL mpc process with PID ${mpClientProcess.pid}`);
          mpClientProcess.stdout.removeAllListeners();
          mpClientProcess.stderr.removeAllListeners();
          mpClientProcess.removeAllListeners('close');
          mpClientProcess.kill('SIGKILL');
        };
      }).pipe(takeUntil(killSignal$));

    const respawnMpc = () =>
      concat(pollMpcProcess(), spawnMpc()).pipe(
        catchError((err) => {
          console.error(`[Fatal] Spawn cancelled: ${err.message}`);
          return EMPTY;
        })
      );

    const publishedMpClientEvent$ = resetProcess$.pipe(
      startWith(null),
      concatMap(respawnMpc),
      share()
    );

    return {
      sendMpCommand,
      publisher: () => publishedMpClientEvent$,
      reset: () => {
        killSignal$.next();
        resetProcess$.next();
      },
      terminate: () => {
        killSignal$.next();
        resetProcess$.complete();
      },
    };
  })();
};

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new MpClient();
    }

    return instance;
  },
};
