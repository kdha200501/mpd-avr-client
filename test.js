#!/home/jacks/.nvm/versions/node/v18.20.5/bin/node

'use strict';

const { argv: appConfig } = require('yargs')
  .usage('Usage: $0 [options]')
  .alias('o', 'osdMaxLength')
  .nargs('o', 1)
  .number('o')
  .default('o', 14)
  .describe(
    'o',
    'Specify the maximum number of characters that can be put on the OSD, defaults to 14'
  )
  .alias('v', 'audioVolumePreset')
  .nargs('v', 1)
  .number('v')
  .describe(
    'v',
    'Optionally set the audio volume when the AVR wakes up. Conversion from gain level to volume level can vary depending on the model. For Yamaha RX-V385, -43dB is 38'
  )
  .help('h')
  .alias('h', 'help');

const { osdMaxLength, audioVolumePreset } = /** @type AppConfig */ appConfig;

console.log('osdMaxLength:', osdMaxLength);
console.log('audioVolumePreset:', audioVolumePreset);
