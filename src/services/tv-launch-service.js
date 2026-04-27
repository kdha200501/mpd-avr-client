const { readFile } = require('fs');
const { Observable, of, throwError, forkJoin, concat } = require('rxjs');
const {
  take,
  takeLast,
  shareReplay,
  switchMap,
  map,
  catchError,
} = require('rxjs/operators');

const { tvLaunchProfileTypeTvTypeMap } = require('../../const');

const HttpClient = require('../clients/http-client');

const TvLaunchService = function (_appConfig) {
  return ((appConfig) => {
    let /** @type string */ tvLaunchProfilePath;
    let /** @type TvType */ tvType;
    for (const tvLaunchProfileType of tvLaunchProfileTypeTvTypeMap.keys()) {
      if (!appConfig[tvLaunchProfileType]) {
        continue;
      }

      tvLaunchProfilePath = appConfig[tvLaunchProfileType];
      tvType = tvLaunchProfileTypeTvTypeMap.get(tvLaunchProfileType);
    }

    const httpClient = new HttpClient();

    const braviaPayloadBase =
      /** @type {Pick<BraviaPayload, "version" | "id" | "params">} */ {
        version: '1.0',
        id: 1,
        params: [],
      };

    const tvLaunchProfile$ =
      /** @type Observable<TvLaunchProfile> */ new Observable((subscriber) => {
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
      }).pipe(shareReplay());

    const isEnabled = () => !!tvType;

    const getAppTitle = () =>
      tvLaunchProfile$.pipe(
        map(({ appTitle }) => appTitle),
        catchError(() => of({})),
        take(1)
      );

    const wake = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/system',
                {
                  ...braviaPayloadBase,
                  method: 'setPowerStatus',
                  params: [{ status: true }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const standBy = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/system',
                {
                  ...braviaPayloadBase,
                  method: 'setPowerStatus',
                  params: [{ status: false }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const listApps = () =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/appControl',
                {
                  ...braviaPayloadBase,
                  method: 'getApplicationList',
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const launchApp = (uri) =>
      tvLaunchProfile$.pipe(
        switchMap((tvLaunchProfile) => {
          const { hostname } = /** @type TvLaunchProfile */ tvLaunchProfile;

          switch (tvType) {
            case 'BRAVIA':
              const { preSharedKey } =
                /** @type BraviaLaunchProfile */ tvLaunchProfile;
              return httpClient.post(
                hostname,
                '/sony/appControl',
                {
                  ...braviaPayloadBase,
                  method: 'setActiveApp',
                  params: [{ uri }],
                },
                preSharedKey && { 'X-Auth-PSK': preSharedKey }
              );
            default:
              return throwError(null);
          }
        }),
        catchError(() => of({})),
        take(1)
      );

    const wakeAndLaunchAppForBravia = () =>
      forkJoin(listApps(), getAppTitle()).pipe(
        switchMap(([braviaResponse, appTitle]) => {
          const { result, error } = /** @type BraviaResponse */ braviaResponse;

          // if the API call to the TV failed or the response contains error
          if (!result || error) {
            // then do not wake the TV
            return of({});
          }

          const [braviaApps] = /** @type [BraviaApp[]] */ result || [[]];

          const braviaAppMap = new Map(
            braviaApps.map((braviaApp) => [braviaApp.title, braviaApp])
          );

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is no specified app in the launch profile
          if (!appTitle) {
            // then wake the TV, only
            return wake();
          }

          const { uri } =
            /** @type BraviaApp */ braviaAppMap.get(appTitle) || {};

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is a specified app in the launch profile, and
          // if the specified app is not installed on the TV
          if (!uri) {
            // then wake the TV, only
            return wake();
          }

          // if the API call to the TV succeeded and the response does not contain error, and
          // if there is a specified app in the launch profile, and
          // if the specified app is installed on the TV,
          // then wake the TV and then launch the app
          return concat(wake(), launchApp(uri));
        }),
        takeLast(1)
      );

    const wakeAndLaunchApp = () => {
      switch (tvType) {
        case 'BRAVIA':
          return wakeAndLaunchAppForBravia();
        default:
          return throwError(null);
      }
    };

    return {
      isEnabled,
      wakeAndLaunchApp,
      standBy,
    };
  })(_appConfig);
};

module.exports = TvLaunchService;
