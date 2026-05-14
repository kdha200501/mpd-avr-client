const { readFile } = require('fs');
const { Observable, of, forkJoin, concat } = require('rxjs');
const {
  take,
  takeLast,
  shareReplay,
  switchMap,
  map,
  catchError,
} = require('rxjs/operators');

const HttpClient = require('../clients/http-client');
const {
  arrowUpKeyupRegExp,
  arrowDownKeyupRegExp,
  arrowLeftKeyupRegExp,
  arrowRightKeyupRegExp,
  enterKeyupRegExp,
  returnKeyupRegExp,
  playKeyupRegExp,
  pauseKeyupRegExp,
  stopKeyupRegExp,
  nextKeyupRegExp,
  previousKeyupRegExp,
  redFunctionKeyupRegExp,
  greenFunctionKeyupRegExp,
  yellowFunctionKeyupRegExp,
  blueFunctionKeyupRegExp,
} = require('../const');

const BraviaService = function (_tvLaunchProfilePath) {
  return ((tvLaunchProfilePath) => {
    const httpClient = new HttpClient();

    const braviaPayloadBase = {
      version: '1.0',
      id: 1,
      params: [],
    };

    const tvLaunchProfile$ =
      /** @type Observable<BraviaLaunchProfile> */ new Observable(
        (subscriber) => {
          readFile(tvLaunchProfilePath, (err, data) => {
            if (err) {
              return subscriber.error(err);
            }

            try {
              subscriber.next(JSON.parse(data.toString()));
              subscriber.complete();
            } catch (err) {
              subscriber.error(err);
              subscriber.complete();
            }
          });

          return () => {};
        }
      ).pipe(shareReplay());

    const getAppTitle = () =>
      tvLaunchProfile$.pipe(
        map(({ appTitle }) => appTitle),
        catchError(() => of({})),
        take(1)
      );

    const keyCommandMap$ = tvLaunchProfile$.pipe(
      switchMap(({ hostname, preSharedKey }) =>
        httpClient.post(
          hostname,
          '/sony/system',
          {
            ...braviaPayloadBase,
            method: 'getRemoteControllerInfo',
          },
          preSharedKey && { 'X-Auth-PSK': preSharedKey }
        )
      ),
      map((braviaResponse) => {
        const { result } = /** @type BraviaResponse */ braviaResponse;
        const [_, irccButtons] =
          /** @type {[unknown, BraviaRemoteControllerButton[]]} */ result ?? [];
        return new Map(irccButtons.map(({ name, value }) => [name, value]));
      }),
      catchError(() => of(new Map())),
      shareReplay()
    );

    const braviaAppMap$ = tvLaunchProfile$.pipe(
      switchMap(({ hostname, preSharedKey }) =>
        httpClient.post(
          hostname,
          '/sony/appControl',
          {
            ...braviaPayloadBase,
            method: 'getApplicationList',
          },
          preSharedKey && { 'X-Auth-PSK': preSharedKey }
        )
      ),
      map((braviaResponse) => {
        const { result } = /** @type BraviaResponse */ braviaResponse;
        const [braviaApps] = /** @type [BraviaApp[]] */ result ?? [];
        return new Map(
          braviaApps.map((braviaApp) => [braviaApp.title, braviaApp])
        );
      }),
      catchError(() => of(new Map())),
      shareReplay()
    );

    const wake = () =>
      tvLaunchProfile$.pipe(
        switchMap(({ hostname, preSharedKey }) =>
          httpClient.post(
            hostname,
            '/sony/system',
            {
              ...braviaPayloadBase,
              method: 'setPowerStatus',
              params: [{ status: true }],
            },
            preSharedKey && { 'X-Auth-PSK': preSharedKey }
          )
        ),
        catchError(() => of({})),
        take(1)
      );

    const standBy = () =>
      tvLaunchProfile$.pipe(
        switchMap(({ hostname, preSharedKey }) =>
          httpClient.post(
            hostname,
            '/sony/system',
            {
              ...braviaPayloadBase,
              method: 'setPowerStatus',
              params: [{ status: false }],
            },
            preSharedKey && { 'X-Auth-PSK': preSharedKey }
          )
        ),
        catchError(() => of({})),
        take(1)
      );

    const launchApp = (uri) =>
      tvLaunchProfile$.pipe(
        switchMap(({ hostname, preSharedKey }) =>
          httpClient.post(
            hostname,
            '/sony/appControl',
            {
              ...braviaPayloadBase,
              method: 'setActiveApp',
              params: [{ uri }],
            },
            preSharedKey && { 'X-Auth-PSK': preSharedKey }
          )
        ),
        catchError(() => of({})),
        take(1)
      );

    const wakeAndLaunchApp = () =>
      forkJoin(getAppTitle(), braviaAppMap$).pipe(
        switchMap(([appTitle, braviaAppMap]) => {
          if (!appTitle) {
            return wake();
          }

          const { uri } =
            /** @type BraviaApp */ braviaAppMap.get(appTitle) || {};

          if (!uri) {
            return wake();
          }

          return concat(wake(), launchApp(uri));
        }),
        takeLast(1)
      );

    const getIrccButtonName = (cecTransmission) => {
      if (arrowUpKeyupRegExp.test(cecTransmission)) {
        return 'Up';
      }
      if (arrowDownKeyupRegExp.test(cecTransmission)) {
        return 'Down';
      }
      if (arrowLeftKeyupRegExp.test(cecTransmission)) {
        return 'Left';
      }
      if (arrowRightKeyupRegExp.test(cecTransmission)) {
        return 'Right';
      }
      if (enterKeyupRegExp.test(cecTransmission)) {
        return 'Confirm';
      }
      if (returnKeyupRegExp.test(cecTransmission)) {
        return 'Return';
      }
      if (playKeyupRegExp.test(cecTransmission)) {
        return 'Play';
      }
      if (pauseKeyupRegExp.test(cecTransmission)) {
        return 'Pause';
      }
      if (stopKeyupRegExp.test(cecTransmission)) {
        return 'Stop';
      }
      if (nextKeyupRegExp.test(cecTransmission)) {
        return 'Next';
      }
      if (previousKeyupRegExp.test(cecTransmission)) {
        return 'Prev';
      }
      if (redFunctionKeyupRegExp.test(cecTransmission)) {
        return 'Red';
      }
      if (greenFunctionKeyupRegExp.test(cecTransmission)) {
        return 'Green';
      }
      if (yellowFunctionKeyupRegExp.test(cecTransmission)) {
        return 'Yellow';
      }
      if (blueFunctionKeyupRegExp.test(cecTransmission)) {
        return 'Blue';
      }
    };

    const sendIrcc = (command) =>
      tvLaunchProfile$.pipe(
        switchMap(({ hostname, preSharedKey }) =>
          httpClient.postXml(
            hostname,
            '/sony/ircc',
            `<?xml version="1.0" encoding="utf-8"?>
            <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
              <s:Body>
                <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
                  <IRCCCode>${command}</IRCCCode>
                </u:X_SendIRCC>
              </s:Body>
            </s:Envelope>`,
            {
              ...(preSharedKey && { 'X-Auth-PSK': preSharedKey }),
              SOAPACTION: '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
            }
          )
        ),
        catchError(() => of(null)),
        take(1)
      );

    const relayKeyEvent = (cecTransmission) =>
      keyCommandMap$.pipe(
        switchMap((keyCommandMap) => {
          const irccButtonName = getIrccButtonName(cecTransmission);

          if (!irccButtonName) {
            return of(null);
          }

          const command = keyCommandMap.get(irccButtonName);

          if (!command) {
            return of(null);
          }

          return sendIrcc(command);
        }),
        take(1)
      );

    return {
      standBy,
      wakeAndLaunchApp,
      relayKeyEvent,
    };
  })(_tvLaunchProfilePath);
};

let instance;

module.exports = {
  getInstance: (tvLaunchProfilePath) => {
    if (!instance) {
      instance = new BraviaService(tvLaunchProfilePath);
    }

    return /** @type {TVService} */ instance;
  },
};
