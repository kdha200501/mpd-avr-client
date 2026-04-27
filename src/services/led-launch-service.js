const { readFile } = require('fs');
const { spawn } = require('child_process');
const { Observable, of, throwError } = require('rxjs');
const { take, shareReplay, switchMap, catchError } = require('rxjs/operators');

const { ledLaunchProfileTypeLedTypeMap } = require('../../const');

const LedLaunchService = function (_appConfig) {
  return ((appConfig) => {
    let /** @type string */ ledLaunchProfilePath;
    let /** @type LedType */ ledType;
    for (const ledLaunchProfileType of ledLaunchProfileTypeLedTypeMap.keys()) {
      if (!appConfig[ledLaunchProfileType]) {
        continue;
      }

      ledLaunchProfilePath = appConfig[ledLaunchProfileType];
      ledType = ledLaunchProfileTypeLedTypeMap.get(ledLaunchProfileType);
    }

    /**
     * Generates a Govee BLE payload with the correct checksum.
     * @param {boolean} ledOn - Desired power state
     * @returns {string} 40-character (i.e. 20 Bytes) long hex string
     */
    function generateGoveePowerPayload(ledOn) {
      const payload = Buffer.alloc(20, 0x00);

      payload[0] = 0x33; // Command header
      payload[1] = 0x01; // Command: Power
      payload[2] = ledOn ? 0x01 : 0x00;
      payload[19] = payload.reduce((acc, item) => acc ^ item, 0);

      return payload.toString('hex');
    }

    const ledLaunchProfile$ =
      /** @type Observable<LedLaunchProfile> */ new Observable((subscriber) => {
        readFile(ledLaunchProfilePath, (err, data) => {
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

    const isEnabled = () => !!ledType;

    const wake = () =>
      ledLaunchProfile$.pipe(
        switchMap((ledLaunchProfile) => {
          switch (ledType) {
            case 'GOVEE':
              const { macAddress, rowNumberHex } =
                /** @type GoveeLaunchProfile */ ledLaunchProfile;
              return new Promise((resolve) => {
                const child = spawn('gatttool', [
                  '-t',
                  'random',
                  '-b',
                  macAddress,
                  '--char-write-req',
                  '-a',
                  rowNumberHex,
                  '-n',
                  generateGoveePowerPayload(true),
                ]);

                child.on('close', () => resolve(null));
                child.on('error', () => resolve(null));

                /**
                 * @desc kill process if the LED strip is paired to another device
                 */
                setTimeout(() => {
                  child && child.kill();
                  resolve(null);
                }, 1000);
              });
            default:
              return throwError(null);
          }
        }),
        catchError(() => of(null)),
        take(1)
      );

    const standBy = () =>
      ledLaunchProfile$.pipe(
        switchMap((ledLaunchProfile) => {
          switch (ledType) {
            case 'GOVEE':
              const { macAddress, rowNumberHex } =
                /** @type GoveeLaunchProfile */ ledLaunchProfile;
              return new Promise((resolve) => {
                const child = spawn('gatttool', [
                  '-t',
                  'random',
                  '-b',
                  macAddress,
                  '--char-write-req',
                  '-a',
                  rowNumberHex,
                  '-n',
                  generateGoveePowerPayload(false),
                ]);

                child.on('close', () => resolve(null));
                child.on('error', () => resolve(null));

                /**
                 * @desc kill process if the LED strip is paired to another device
                 */
                setTimeout(() => {
                  child && child.kill();
                  resolve(null);
                }, 1000);
              });
            default:
              return throwError(null);
          }
        }),
        catchError(() => of(null)),
        take(1)
      );

    return {
      isEnabled,
      wake,
      standBy,
    };
  })(_appConfig);
};

module.exports = LedLaunchService;
