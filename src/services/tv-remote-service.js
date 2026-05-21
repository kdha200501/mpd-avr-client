const { readFile } = require('fs');
const { Observable } = require('rxjs');
const { shareReplay } = require('rxjs/operators');

const TvRemoteService = function (_commandOptions) {
  return ((commandOptions) => {
    const { infraredRemoteControlMappingForTv } =
      /** @type {MainCommandOptions} */ commandOptions;

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
  })(_commandOptions);
};

module.exports = TvRemoteService;
