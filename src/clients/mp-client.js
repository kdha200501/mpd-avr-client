const { spawn } = require('child_process');
const { defer, Observable } = require('rxjs');
const { share } = require('rxjs/operators');

const MpService = require('../services/mp-service');

let instance;

const MpClient = function () {
  return (() => {
    let mpClientProcess;

    const mpClientEvent$ = /** @type Observable<MpClientEvent> */ defer(() => {
      mpClientProcess = spawn('mpc', ['idleloop']);

      return new Observable((subscriber) => {
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
      });
    }).pipe(share());

    const publisher = () => mpClientEvent$;

    const terminate = () => {
      if (mpClientProcess) {
        mpClientProcess.kill();
      }
    };

    return { publisher, terminate };
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
