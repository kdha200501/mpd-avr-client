const { Subject } = require('rxjs');

const AppTerminator = function () {
  return ((clients) => {
    const destroy$ = new Subject();

    const publisher = () => destroy$;

    const onExit = (isKillSignal = false) => {
      for (const client of clients) {
        client?.terminate();
      }

      destroy$.next(null);
      destroy$.complete();

      if (isKillSignal) {
        return;
      }

      process.exit();
    };

    return { publisher, onExit };
  })([...arguments]);
};

module.exports = AppTerminator;
