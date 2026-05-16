#!/usr/bin/env node

'use strict';

const yargs = require('yargs');

const main = require('./commands/main');
const mapKeys = require('./commands/map-keys');

const _ = yargs(process.argv.slice(2))
  .command(main)
  .command(mapKeys)
  .help()
  .alias('h', 'help')
  .wrap(Math.min(100, yargs.terminalWidth())).argv;
