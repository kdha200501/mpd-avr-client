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
  switchMap,
  debounceTime,
} = require('rxjs/operators');

const { scancodeRegex } = require('../const');

const pollEvtestProcess = () =>
  timer(0, 500).pipe(
    switchMap(() => from(find('name', 'evtest'))),
    switchMap((list, index) => {
      // if there is no existing evtest process
      if (!list.length) {
        // then skip polling
        return of(true);
      }

      // if there is existing evtest process, and
      // if the maximum number of poll has not been reached
      if (index < 5) {
        // then continue polling
        return EMPTY;
      }

      // if there is existing evtest process, and
      // if the maximum number of poll has been reached,
      // then give up on polling
      return throwError(
        () => new Error('OS_RESOURCE_LOCK: evtest failed to exit.')
      );
    }),
    first(),
    ignoreElements()
  );

const LircClient = function (_infraredDevice) {
  return ((infraredDevice) => {
    const resetProcess$ = new Subject();
    const killSignal$ = new Subject();

    const spawnEvtest = () =>
      new Observable((subscriber) => {
        const source = 'lircClient';

        const onData = (data) => {
          for (const [_, scancode] of data.toString().matchAll(scancodeRegex)) {
            subscriber.next({
              source,
              data: scancode,
            });
          }
        };

        const evtestProcess = spawn('evtest', ['--grab', infraredDevice]);

        evtestProcess.stdout.on('data', onData);
        evtestProcess.stderr.on('data', onData);

        return () => {
          evtestProcess.stdout.removeAllListeners();
          evtestProcess.stderr.removeAllListeners();
          evtestProcess.removeAllListeners('close');
          evtestProcess.kill('SIGKILL');
        };
      }).pipe(takeUntil(killSignal$));

    const respawnEvtest = () =>
      concat(pollEvtestProcess(), spawnEvtest()).pipe(
        catchError((err) => {
          console.error(`[Fatal] Spawn cancelled: ${err.message}`);
          return EMPTY;
        })
      );

    const publishedLircClientEvent$ =
      /** @type Observable<LircClientEvent>*/ resetProcess$.pipe(
        startWith(null),
        concatMap(respawnEvtest),
        debounceTime(100),
        share()
      );

    return {
      publisher: () => publishedLircClientEvent$,
      reset: () => {
        killSignal$.next();
        resetProcess$.next();
      },
      terminate: () => {
        killSignal$.next();
        resetProcess$.complete();
      },
    };
  })(_infraredDevice);
};

let instance;

module.exports = {
  getInstance: (commandOptions) => {
    if (!instance) {
      const { infraredDevice } =
        /** @type {MapKeysCommandOptions} */ commandOptions;

      instance = new LircClient(infraredDevice);
    }

    return instance;
  },
};
