const { spawn } = require('child_process');
const { defer, Observable } = require('rxjs');
const { share } = require('rxjs/operators');

const CecClient = function () {
  return (() => {
    let cecClientProcess;

    const cecClientEvent$ = /** @type Observable<CecClientEvent>*/ defer(() => {
      cecClientProcess = spawn('cec-client', ['-o', 'Loading...']);

      return new Observable((subscriber) => {
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
    }).pipe(share());

    const publisher = () => cecClientEvent$;

    const terminate = () => {
      if (cecClientProcess) {
        cecClientProcess.kill();
      }
    };

    const write = (command) => {
      if (cecClientProcess) {
        cecClientProcess.stdin.write(command);
      }
    };

    return { publisher, terminate, write };
  })();
};

let instance;

// Export a factory function instead of the class or a raw instance
module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new CecClient();
    }

    return instance;
  },
};
