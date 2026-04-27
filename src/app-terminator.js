const { Subject } = require('rxjs');
const { getInstance: getCecClient } = require('./clients/cec-client');
const { getInstance: getMpClient } = require('./clients/mp-client');

const AppTerminator = function () {
  return (() => {
    const destroy$ = new Subject();

    const publisher = () => destroy$;

    const onExit = (isKillSignal = false) => {
      getCecClient()?.terminate();
      getMpClient()?.terminate();

      destroy$.next(null);
      destroy$.complete();

      if (isKillSignal) {
        return;
      }

      process.exit();
    };

    return { publisher, onExit };
  })();
};

module.exports = AppTerminator;
