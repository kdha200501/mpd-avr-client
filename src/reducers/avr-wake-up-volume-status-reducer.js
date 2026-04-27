const AvrService = require('../services/avr-service');

const AvrWakeUpVolumeStatusReducer = function (_appConfig) {
  return ((appConfig) => {
    const avrService = new AvrService(appConfig);

    /**
     * Get the initial state
     * @returns {AvrVolumeStatus} The initial state
     */
    const getInitState = () => [];

    /**
     * @desc The aim of this reducer is to retrieve the AVR audio volume when the AVR wakes up
     *       The following objectives are listed chronologically, and they are executed sequentially to avoid timing issues
     *         - wait for the AVR to wake up
     *         - request the volume status from the AVR
     */

    return [
      (acc, cecClientEvent) => {
        const [isAudioDeviceOn] = avrService.decodeAvrPowerStatus(
          /** @type {CecClientEvent} */ cecClientEvent
        );

        // if the CEC transmission is regarding audio turning off (i.e. the AVR goes to stand-by mode)
        if (isAudioDeviceOn === false) {
          // then reset the reducer
          return getInitState();
        }

        // if the CEC transmission is not regarding audio turning off, and
        // if the CEC transmission is regarding audio turning on
        if (isAudioDeviceOn) {
          // then request audio volume status
          /**
           * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
           */
          setTimeout(() => avrService.requestAudioVolume(), 500);
          return [undefined];
        }

        const { length } = /** @type AvrVolumeStatus */ acc;

        // if the CEC transmission is not regarding audio turning off, and
        // if the CEC transmission is not regarding audio turning on, and
        // if a request for the audio volume status was made
        if (length) {
          // then decode the CEC transmission
          return avrService.decodeAvrVolumeStatus(cecClientEvent);
        }

        // if the CEC transmission is not regarding audio turning off, and
        // if the CEC transmission is not regarding audio turning on, and
        // if a request for the audio volume status was not made,
        // then no-op
        return acc;
      },
      getInitState(),
    ];
  })(_appConfig);
};

module.exports = AvrWakeUpVolumeStatusReducer;
