const { tvLaunchProfileTypeTvTypeMap } = require('../const');
const { getInstance: getBraviaService } = require('./bravia-service');

const tvServiceFactory = function (appConfig) {
  const [tvLaunchProfilePath, tvType] = [
    ...tvLaunchProfileTypeTvTypeMap,
  ].reduce((acc, [_tvLaunchProfileType, _tvType]) => {
    const _tvLaunchProfilePath = appConfig[_tvLaunchProfileType];

    if (!_tvLaunchProfilePath) {
      return acc;
    }

    return [_tvLaunchProfilePath, _tvType];
  }, []);

  const isEnabled = () => !!tvType;
  const noop = () => {};

  switch (tvType) {
    case 'BRAVIA': {
      const braviaService = getBraviaService(tvLaunchProfilePath);
      return {
        isEnabled,
        standBy: () => braviaService.standBy(),
        wakeAndLaunchApp: () => braviaService.wakeAndLaunchApp(),
        relayKeyEvent: (cecTransmission) =>
          braviaService.relayKeyEvent(cecTransmission),
      };
    }

    default:
      /** @type {TVService} */
      return {
        isEnabled,
        standBy: noop,
        wakeAndLaunchApp: noop,
        relayKeyEvent: noop,
      };
  }
};

module.exports = tvServiceFactory;
