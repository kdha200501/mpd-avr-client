#!/usr/bin/env node

'use strict';

const yargs = require('yargs');

const main = require('./commands/main');

const _ = yargs(process.argv.slice(2))
  .command(main)
  .help()
  .alias('h', 'help')
  .wrap(Math.min(100, yargs.terminalWidth())).argv;
