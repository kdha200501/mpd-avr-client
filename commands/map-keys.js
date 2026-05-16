'use strict';

const { join } = require('path');
const { access, writeFile } = require('fs/promises');
const {
  createInterface,
  moveCursor,
  cursorTo,
  clearLine,
} = require('node:readline');
const {
  Observable,
  Subject,
  from,
  race,
  of,
  EMPTY,
  concatMap,
  forkJoin,
  defer,
  asapScheduler,
  delay,
} = require('rxjs');
const {
  map,
  mergeScan,
  tap,
  take,
  last,
  filter,
  expand,
  switchMap,
  catchError,
  takeUntil,
} = require('rxjs/operators');
const process = require('process');

const AppTerminator = require('../src/app-terminator');
const { getInstance: getLircClient } = require('../src/clients/lirc-client');
const tvServiceFactory = require('../src/services/tv-service-factory');

const describe = 'Map remote control LIRC codes to IRCC codes';

/** @type {import('yargs').CommandModule<{}, MapKeysCommandOptions>} */
module.exports = {
  command: 'map-keys',
  describe,
  builder: (yargs) =>
    yargs
      .usage(describe)
      .usage('Usage: $0 map-keys [options]')
      .example(
        '$0 map-keys -b ~/.mpd-avr-client/bravia-launch-profile.json -C ~/.mpd-avr-client'
      )
      .option('C', {
        alias: 'directory',
        description: 'Specify the working directory',
        default: process.cwd(),
        type: 'string',
      })
      .option('infraredDevice', {
        alias: 'r',
        nargs: 1,
        type: 'string',
        description:
          'Provide the path to an infrared receiver device, e.g. `/dev/input/event0`.',
        demandOption: true,
      })
      .option('braviaLaunchProfile', {
        alias: 'b',
        nargs: 1,
        type: 'string',
        description:
          'Provide the path to a launch profile for Sony Bravia TV when mapping remote control buttons to IRCC events',
      }),

  handler: (commandOptions) => {
    const cwd = commandOptions.directory;

    const lircClient = getLircClient(commandOptions); // read-only client
    const appTerminator = new AppTerminator(lircClient);

    const tvService = tvServiceFactory(commandOptions);

    const lircCode$ = lircClient.publisher().pipe(map(({ data }) => data));
    const destroy$ = appTerminator.publisher();

    const appendToLircCodeIrccCodePair = (
      lircCodeIrccCodePairs,
      button,
      irccCode
    ) =>
      race(
        lircCode$,
        new Observable((subscriber) => {
          const readline = createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false, // prevent echoing duplicate lines
          });

          readline.on('line', () => subscriber.next(undefined));

          return () => readline.close();
        })
      ).pipe(
        take(1),
        map((lircCode) => [
          ...lircCodeIrccCodePairs,
          [button, lircCode, irccCode],
        ])
      );

    const askQuestion = (query) =>
      new Observable((subscriber) => {
        const readline = createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        readline.question(query, (answer) => {
          subscriber.next(answer);
          subscriber.complete();
        });

        return () => readline.close();
      });

    const handleFileName = (fileName) => {
      if (fileName === '') {
        return of('');
      }

      const filePath = join(cwd, fileName);

      return from(access(filePath)).pipe(
        switchMap(() =>
          askQuestion(
            `⚠️ File "${fileName}" exists under ${cwd}. Override? [y/N]: `
          )
        ),
        map((answer) => {
          const override = answer.trim().toLowerCase() === 'y';
          return override ? filePath : '';
        }),
        catchError(() => of(filePath))
      );
    };

    const getFilePath = () =>
      askQuestion('💾 Enter file name: ').pipe(
        switchMap(handleFileName),
        /**
         * @desc tell RxJS to execute this on the next microtask/macroTask boundary to avoid the stdin leaking into the retry
         */
        delay(0, asapScheduler)
      );

    const getValidFilePath = () =>
      defer(() =>
        of('').pipe(
          expand((filePath) => (filePath ? EMPTY : getFilePath())),
          filter((path) => path !== ''),
          take(1)
        )
      );

    const buttonIrccCodePairs$ = tvService
      .getButtonIrccCodePairs()
      .pipe(concatMap(from));

    buttonIrccCodePairs$
      .pipe(
        mergeScan(
          (acc, [button, irccCode]) => {
            if (acc.length) {
              console.log('');
            }

            console.log(
              `🔘 Press the remote control button corresponding to the "${button}" action`
            );
            console.log('--- or press any keyboard key to skip ---');

            return appendToLircCodeIrccCodePair(acc, button, irccCode);
          },
          [],
          // process emissions sequentially
          1
        ),
        tap((lircCodeIrccCodePairs) => {
          const [_, lircCode] = lircCodeIrccCodePairs.at(-1);
          moveCursor(process.stdout, 0, -1);
          cursorTo(process.stdout, 0);
          clearLine(process.stdout, 'right');
          if (lircCode) {
            process.stdout.write(`\x1b[2K♒ ${lircCode}\n`);
          } else {
            process.stdout.write(`\x1b[2K¯\\_(ツ)_/¯ ${lircCode}\n`);
          }
        }),
        last(),
        switchMap((lircCodeIrccCodePairs) =>
          forkJoin([of(lircCodeIrccCodePairs), getValidFilePath()])
        ),
        switchMap(([lircCodeIrccCodePairs, filePath]) =>
          forkJoin([
            of(filePath),
            writeFile(filePath, JSON.stringify(lircCodeIrccCodePairs, null, 2)),
          ])
        ),
        takeUntil(destroy$)
      )
      .subscribe({
        next: ([filePath]) =>
          console.log(`✨ File successfully saved to: ${filePath}`),
        error: (err) => console.error('❌ An error occurred:', err),
        complete: () => appTerminator.onExit(),
      });

    /**
     * @desc OnDestroy
     */
    process.on('SIGINT', () => {
      appTerminator.onExit(true);
      process.exit(130);
    });
  },
};
