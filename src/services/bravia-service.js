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

    const buttonIrccCodePairs$ = tvLaunchProfile$.pipe(
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
        const [_, braviaRemoteControllerButton] =
          /** @type {[unknown, BraviaRemoteControllerButton[]]} */ result ?? [];
        return braviaRemoteControllerButton.map(({ name, value }) => [
          name,
          value,
        ]);
      }),
      catchError(() => of([])),
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
      tvLaunchProfile$
        .pipe(
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
        )
        .subscribe();

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
      forkJoin([getAppTitle(), braviaAppMap$])
        .pipe(
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
        )
        .subscribe();

    const sendIrccCode = (irccCode) =>
      tvLaunchProfile$
        .pipe(
          switchMap(({ hostname, preSharedKey }) =>
            httpClient.postXml(
              hostname,
              '/sony/ircc',
              `<?xml version="1.0" encoding="utf-8"?>
            <s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
              <s:Body>
                <u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1">
                  <IRCCCode>${irccCode}</IRCCCode>
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
        )
        .subscribe();

    const getButtonIrccCodePairs = () => buttonIrccCodePairs$;

    return {
      standBy,
      wakeAndLaunchApp,
      sendIrccCode,
      getButtonIrccCodePairs,
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
