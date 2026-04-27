const {
  playKeyupRegExp,
  playRegExp,
  pauseKeyupRegExp,
  pauseRegExp,
  redFunctionKeyupRegExp,
  greenFunctionKeyupRegExp,
} = require('../../const');
const AvrService = require('../services/avr-service');

const PromptRenderer = function (_appConfig) {
  return ((appConfig) => {
    const avrService = new AvrService(appConfig);

    return ([cecClientEvent, appState]) => {
      const { data: cecTransmission } =
        /** @type CecClientEvent */ cecClientEvent;
      const { state, repeat, random } = /** @type AppState */ appState;
      let /** @type string */ message;

      /**
       * @desc play action
       */
      if (playKeyupRegExp.test(cecTransmission) && !playRegExp.test(state)) {
        message = 'play';
        return avrService.updateOsd(message);
      }

      /**
       * @desc pause action
       */
      if (pauseKeyupRegExp.test(cecTransmission) && !pauseRegExp.test(state)) {
        message = 'pause';
        return avrService.updateOsd(message);
      }

      /**
       * @desc toggle repeat action
       */
      if (redFunctionKeyupRegExp.test(cecTransmission)) {
        message = `repeat: ${repeat === '1' ? 'OFF' : 'ON'}`;
        return avrService.updateOsd(message);
      }

      /**
       * @desc toggle random action
       */
      if (greenFunctionKeyupRegExp.test(cecTransmission)) {
        message = `random: ${random === '1' ? 'OFF' : 'ON'}`;
        return avrService.updateOsd(message);
      }
    };
  })(_appConfig);
};

module.exports = PromptRenderer;
