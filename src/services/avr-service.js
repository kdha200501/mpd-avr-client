const { from } = require('rxjs');
const { concatMap, takeLast } = require('rxjs/operators');

const {
  avrRequestDisplayNameRegExp,
  avrTurnOnRegExp,
  avrStandByRegExp,
  avrIsOnRegExp,
  avrIsStandByRegExp,
  volumeStatusRegExp,
} = require('../../const');
const { getInstance: getCecClient } = require('../clients/cec-client');

const AvrService = function (_appConfig) {
  return ((appConfig) => {
    const cecClient = getCecClient();
    const { osdMaxLength, audioVolumePreset } =
      /** @type AppConfig */ appConfig;

    const convertOsdToHex = (message) =>
      [...message.padEnd(osdMaxLength, ' ')]
        .slice(0, osdMaxLength)
        .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(':');

    /**
     * Run a CEC command
     * @param {string} command A CEC command
     * @returns {void} No output
     */
    const runCommand = (command) => void cecClient.write(command);

    const requestPowerStatus = () => runCommand('pow 5');

    /**
     * Display a message on the AVR OSD
     * @param {string} message A message
     * @returns {void} No output
     */
    const updateOsd = (message) =>
      runCommand(`tx 15:47:${convertOsdToHex(message)}`);

    const increaseVolume = () => runCommand('volup');

    const decreaseVolume = () => runCommand('voldown');

    const requestAudioVolume = () => runCommand('tx 15:71');

    const setActiveSource = () => runCommand('as');

    /**
     * Decode the AVR power status from a CEC Client Event
     * @param {CecClientEvent} cecClientEvent A CEC Client Event
     * @returns {AvrPowerStatus} The AVR power status
     */
    const decodeAvrPowerStatus = (cecClientEvent) => {
      const { data: cecTransmission } = cecClientEvent;

      if (avrIsOnRegExp.test(cecTransmission)) {
        return [true];
      }

      if (avrIsStandByRegExp.test(cecTransmission)) {
        return [false];
      }

      if (avrTurnOnRegExp.test(cecTransmission)) {
        return [true];
      }

      if (avrStandByRegExp.test(cecTransmission)) {
        return [false];
      }

      return [undefined];
    };

    /**
     * Determine whether an AVR Power Status is valid
     * @param {AvrPowerStatus} avrPowerStatus An AVR Power Status
     * @returns {boolean} the validity of an AVR Power Status
     */
    const isAvrPowerStatusValid = ([isAudioDeviceOn]) =>
      isAudioDeviceOn !== undefined;

    /**
     * Decode the AVR audio volume status from CEC Client Event
     * @param {CecClientEvent} cecClientEvent A CEC Client Event
     * @returns {AvrVolumeStatus} The audio mute and volume in hex
     */
    const decodeAvrVolumeStatus = (cecClientEvent) => {
      const { data: cecTransmission } = cecClientEvent;

      if (!volumeStatusRegExp.test(cecTransmission)) {
        return [undefined];
      }

      const [_, __, ___, volumeInHex] = cecTransmission
        .toString()
        .match(volumeStatusRegExp);
      return [volumeInHex.replace(/:/g, '')];
    };

    /**
     * Determine whether a cec-client event is caused by the AVR requesting the host's name
     * @param {CecClientEvent} cecClientEvent A cec-client event
     * @returns {boolean} whether a cec-client event is caused by AVR requesting the host's name
     */
    const isAvrRequestDisplayName = (cecClientEvent) => {
      if (!cecClientEvent) {
        return false;
      }

      const { data: cecTransmission } = cecClientEvent;
      return avrRequestDisplayNameRegExp.test(cecTransmission);
    };

    /**
     * Adjust the AVR audio volume
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR volume status
     * @param {number} [audioVolumeOverride] Optionally override the audio volume preset
     * @returns {Observable<void>} An observable of no output
     */
    const adjustAudioVolume = (
      [avrMuteAndVolumeInHex],
      audioVolumeOverride = audioVolumePreset
    ) => {
      let { length } = avrMuteAndVolumeInHex;
      const muteStatusMaskOverflow = 2 ** ((length / 2) * 8); // 2 ^ (number of bits)
      const muteStatusMask = muteStatusMaskOverflow / 2; // the left-most bit is the mute status
      const volumeStatusMask = muteStatusMask - 1; // invert the mask to get a mask for the remainder bits

      const audioVolumeInDecimal =
        parseInt(avrMuteAndVolumeInHex, 16) & volumeStatusMask;

      const vector = Math.floor(audioVolumeOverride - audioVolumeInDecimal);
      const sign = Math.sign(vector);
      length = Math.abs(vector);

      /**
       * @desc Unfortunately, there is no way to set volume to a particular value using CEC, as a result, audio volume is adjusted one unit at a time
       */
      return from(Array.from({ length }).map(() => Math.max(sign, 0))).pipe(
        concatMap(
          (shouldIncrease) =>
            new Promise((resolve) => {
              shouldIncrease ? increaseVolume() : decreaseVolume();
              /**
               * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
               */
              setTimeout(resolve, 500);
            })
        ),
        takeLast(1)
      );
    };

    /**
     * Determine whether an AVR Volume Status is valid
     * @param {AvrVolumeStatus} avrPowerStatus An AVR Volume Status
     * @returns {boolean} the validity of an AVR Volume Status
     */
    const isAvrVolumeStatsValid = ([avrMuteAndVolumeInHex]) =>
      avrMuteAndVolumeInHex !== undefined;

    return {
      runCommand,
      requestPowerStatus,
      updateOsd,
      increaseVolume,
      decreaseVolume,
      requestAudioVolume,
      setActiveSource,
      decodeAvrPowerStatus,
      isAvrPowerStatusValid,
      decodeAvrVolumeStatus,
      isAvrVolumeStatsValid,
      isAvrRequestDisplayName,
      adjustAudioVolume,
    };
  })(_appConfig);
};

module.exports = AvrService;
