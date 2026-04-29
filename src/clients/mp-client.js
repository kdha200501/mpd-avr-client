const { spawn } = require('child_process');
const { Observable, switchMap, Subject } = require('rxjs');
const { startWith, takeUntil, share } = require('rxjs/operators');

const MpService = require('../services/mp-service');

let instance;

const MpClient = function () {
  return (() => {
    const resetProcess$ = new Subject();
    const destroyPublisher$ = new Subject();
    const publishedMpClientEvent$ =
      /** @type Observable<MpClientEvent> */ resetProcess$.pipe(
        startWith(null),
        switchMap(
          () =>
            new Observable((subscriber) => {
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

              const mpClientProcess = spawn('mpc', ['idleloop']);
              console.log(`mpc process started wid PID ${mpClientProcess.pid}`);

              // emit next event
              mpClientProcess.stdout.on('data', onData);
              mpClientProcess.stderr.on('data', onData);

              // emit complete and error event
              mpClientProcess.on('close', onClose);

              return () => mpClientProcess.kill();
            })
        ),
        takeUntil(destroyPublisher$),
        share()
      );

    const publisher = () => publishedMpClientEvent$;

    const reset = () => resetProcess$.next();

    const terminate = () => {
      destroyPublisher$.next();
      destroyPublisher$.complete();
      resetProcess$.complete();
    };

    return { publisher, reset, terminate };
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
