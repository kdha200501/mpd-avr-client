const { ledLaunchProfileTypeLedTypeMap } = require('../const');
const { getInstance: getGoveeService } = require('./govee-service');

const ledServiceFactory = function (commandOptions) {
  const [ledLaunchProfilePath, ledType] = [
    ...ledLaunchProfileTypeLedTypeMap,
  ].reduce((acc, [_ledLaunchProfileType, _ledType]) => {
    const _ledLaunchProfilePath = commandOptions[_ledLaunchProfileType];

    if (!_ledLaunchProfilePath) {
      return acc;
    }

    return [_ledLaunchProfilePath, _ledType];
  }, []);

  const isEnabled = () => !!ledType;
  const noop = () => {};

  switch (ledType) {
    case 'GOVEE': {
      const goveeService = getGoveeService(ledLaunchProfilePath);
      return {
        isEnabled,
        wake: () => goveeService.wake(),
        standBy: () => goveeService.standBy(),
      };
    }

    default:
      /** @type {LedService} */
      return {
        isEnabled,
        wake: noop,
        standBy: noop,
      };
  }
};

module.exports = ledServiceFactory;
