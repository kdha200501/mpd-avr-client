const { spawn } = require('child_process');

const BluetoothClient = function () {
  return (() => {
    const write = (macAddress, characteristicAddress, hexPayload) =>
      new Promise((resolve) => {
        const child = spawn('gatttool', [
          '-t',
          'random',
          '-b',
          macAddress,
          '--char-write-req',
          '-a',
          characteristicAddress,
          '-n',
          hexPayload,
        ]);

        child.on('close', () => resolve(null));
        child.on('error', () => resolve(null));

        /**
         * @desc kill process if the LED strip is paired to another device
         */
        setTimeout(() => {
          if (!child) {
            return;
          }

          child.kill();
          resolve(null);
        }, 1000);
      });

    return { write };
  })();
};

let instance;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new BluetoothClient();
    }

    return instance;
  },
};
