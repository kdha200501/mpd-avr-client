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
  switchMap,
  first,
  takeUntil,
  ignoreElements,
  share,
  catchError,
} = require('rxjs/operators');

const MpService = require('../services/mp-service');

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
    const resetProcess$ = new Subject();
    const killSignal$ = new Subject();

    const spawnMpc = () =>
      new Observable((subscriber) => {
        const source = 'mpClient';
        const mpService = new MpService();

        const onData = () =>
          mpService
            .getStatus()
            .then((data) => subscriber.next({ source, data }))
            .catch((error) => subscriber.next({ source, data: error }));

        const mpClientProcess = spawn('mpc', ['idleloop']);
        console.log(`mpc process started wid PID ${mpClientProcess.pid}`);

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
