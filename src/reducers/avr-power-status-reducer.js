const AvrService = require('../services/avr-service');

const AvrPowerStatusReducer = function (_appConfig) {
  return ((appConfig) => {
    const avrService = new AvrService(appConfig);

    /**
     * Get the initial state
     * @returns {AvrPowerStatus} The initial state
     */
    const getInitState = () => [];

    /**
     * @desc The aim of this reducer is to retrieve the AVR power status during the initialization of the application
     *       The following objectives are listed chronologically, and they are executed sequentially to avoid timing issues
     *         - wait for the AVR to request for identification from CEC Client
     *         - request the power status from the AVR
     */

    return [
      (acc, _cecClientEvent) => {
        const { length } = /** @type AvrPowerStatus */ acc;
        const cecClientEvent = /** @type CecClientEvent */ _cecClientEvent;

        // if the request for AVR power status has been made
        if (length) {
          // then deduce the AVR power statue from transmissions received
          return avrService.decodeAvrPowerStatus(cecClientEvent);
        }

        // if the request for AVR power status has not been made, and
        // if the AVR is reaching out to identify the host
        if (avrService.isAvrRequestDisplayName(cecClientEvent)) {
          // then make a request for AVR power status
          /**
           * @desc when CEC Client jumps on the HDMI bus, the AVR reaches out to CEC Client and asks for identification
           */
          avrService.requestPowerStatus();
          return [undefined];
        }

        // if the request for AVR power status has not been made, and
        // if the AVR is not reaching out to identify the host,
        // then no-op
        return acc;
      },
      getInitState(),
    ];
  })(_appConfig);
};

module.exports = AvrPowerStatusReducer;
