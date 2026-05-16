const { readFile } = require('fs');
const { Observable } = require('rxjs');
const { shareReplay } = require('rxjs/operators');

const TvRemoteService = function (_appConfig) {
  return ((appConfig) => {
    const { infraredRemoteControlMappingForTv } =
      /** @type {MainCommandOptions} */ appConfig;

    const lircCodeIrccCodeMap$ = new Observable((subscriber) => {
      readFile(infraredRemoteControlMappingForTv, (err, data) => {
        if (err) {
          return subscriber.error(err);
        }

        try {
          const lircCodeIrccCodePairs = JSON.parse(data.toString())
            .map(([_, lircCode, irccCode]) => [lircCode, irccCode])
            .filter(([lircCode, irccCode]) => lircCode && irccCode);

          subscriber.next(new Map(lircCodeIrccCodePairs));
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
          subscriber.complete();
        }
      });

      return () => {};
    }).pipe(shareReplay());

    const getLircCodeIrccCodeMap = () => lircCodeIrccCodeMap$;

    return {
      getLircCodeIrccCodeMap,
    };
  })(_appConfig);
};

module.exports = TvRemoteService;
