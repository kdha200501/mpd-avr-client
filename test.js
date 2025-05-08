#!/home/jacks/.nvm/versions/node/v18.20.5/bin/node

'use strict';

const { spawn } = require('child_process');
const { takeUntil } = require('rxjs/operators');
const { of, forkJoin, switchMap } = require('rxjs');

const { MpService, MpClient, AppTerminator } = require('./utils');
const { playRegExp } = require('./const');

/**
 * @desc Protocol clients
 */
const mpClientProcess = spawn('mpc', ['idleloop']); // read-only client
const mpClient = new MpClient(mpClientProcess);

/**
 * @desc Services
 */
const mpService = new MpService();
const appTerminator = new AppTerminator();

/**
 * @desc Scope members
 */
const mpClientEvent$ = mpClient.publisher();
const destroy$ = appTerminator.publisher();

/**
 * @desc OnInit
 */
of('blue keyup CEC event')
  .pipe(
    switchMap(() => mpService.getStatus()),
    takeUntil(destroy$)
  )
  .subscribe((mpStatus) => {
    const { state } = /** @type MpStatus */ mpStatus;
    console.log('play', playRegExp.test(state));
  });

/**
 * @desc OnDestroy
 */
process.on('SIGINT', () => appTerminator.onExit(true));
