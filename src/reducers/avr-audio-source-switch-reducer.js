const { of } = require('rxjs');
const { delay, switchMap, take } = require('rxjs/operators');

const { blueFunctionKeyupRegExp, playRegExp } = require('../../const');
const AvrService = require('../services/avr-service');
const MpService = require('../services/mp-service');
const TvLaunchService = require('../services/tv-launch-service');
const LedLaunchService = require('../services/led-launch-service');

const AvrAudioSourceSwitchReducer = function (_appConfig) {
  return ((appConfig) => {
    const { handOverAudioToTvCecCommand, audioVolumePresetForTv } =
      /** @type AppConfig */ appConfig;

    const avrService = new AvrService(appConfig);
    const mpService = new MpService();
    const tvLaunchService = new TvLaunchService(appConfig);
    const ledLaunchService = new LedLaunchService(appConfig);

    /**
     * Get the initial state
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} The initial state
     */
    const getInitState = () => [[], [undefined, undefined]];

    /**
     * Initiate the audio source switch sequence by requesting the ARR audio volume
     * @param {AppState} appState The current App State
     * @param {CecClientEvent} cecClientEvent The received CEC Client Event
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} The AVR Volume Status and the MP Status State Transition
     */
    const initiateAudioSourceSwitch = (
      { isAudioDeviceOn },
      { data: cecTransmission }
    ) => {
      // if the AVR is in standby mode
      if (!isAudioDeviceOn) {
        // then reset the reducer
        return getInitState();
      }

      // if the AVR is not in standby mode, and
      // if the CEC transmission is regarding audio source switching
      if (blueFunctionKeyupRegExp.test(cecTransmission)) {
        // then ask AVR for audio volume (to initiate the audio source switching process)
        avrService.requestAudioVolume();
        return [[undefined], [undefined, undefined]];
      }

      // if the AVR is not in standby mode, and
      // if the CEC transmission is not regarding audio source switching,
      // then reset the reducer
      return getInitState();
    };

    /**
     * Switch audio source
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR Audio Status
     * @returns {void} No output
     */
    const switchingAudioSource = (avrVolumeStatus) => {
      avrService.runCommand(handOverAudioToTvCecCommand);

      if (tvLaunchService.isEnabled()) {
        tvLaunchService.wakeAndLaunchApp().subscribe();
      }

      if (ledLaunchService.isEnabled()) {
        ledLaunchService.wake().subscribe();
      }

      if (audioVolumePresetForTv !== undefined) {
        of(audioVolumePresetForTv)
          .pipe(
            /**
             * @desc Unfortunately, there is a limitation to how frequently commands can be transmitted to the AVR, some magic number is used here
             */
            delay(500),
            switchMap(() =>
              avrService.adjustAudioVolume(
                avrVolumeStatus,
                audioVolumePresetForTv
              )
            ),
            take(1)
          )
          .subscribe();
      }
    };

    /**
     * @desc The aim of this reducer is to switch audio source to a Smart TV which is connected to a non-HDMI audio input (on the AVR).
     *       The following objectives are listed chronologically, and they are executed sequentially to avoid timing issues
     *         - request AVR audio volume
     *         - request MP playback pause
     *         - request AVR audio source switch, request Smart TV to wake and launch app
     *         - request AVR audio volume adjustment
     */

    return [
      (acc, [event, appState]) => {
        const [avrVolumeStatus, [fromMpStatusState, toMpStatusState]] =
          /** @type {[AvrVolumeStatus, MpStatusStateTransition]} */ acc;
        const { source } = /** @type {CecClientEvent|MpClientEvent} */ event;

        switch (source) {
          case 'cecClient':
            const cecClientEvent = /** @type CecClientEvent */ event;
            const [isAudioDeviceOn] =
              avrService.decodeAvrPowerStatus(cecClientEvent);

            // if the CEC transmission is regarding audio turning off (i.e. the AVR goes to stand-by mode)
            if (isAudioDeviceOn === false) {
              // then reset the reducer and request the TV and LED strip to go to standby
              tvLaunchService.isEnabled() &&
                tvLaunchService.standBy().subscribe();
              ledLaunchService.isEnabled() &&
                ledLaunchService.standBy().subscribe();
              return getInitState();
            }

            // if the CEC transmission is not regarding audio turning off, and
            // if the reducer is waiting for MP to respond to playback pause request
            if (fromMpStatusState && !toMpStatusState) {
              // then wait for MP to confirm its next state, see case 'mpClient'
              return acc;
            }

            // if the CEC transmission is not regarding audio turning off, and
            // if the reducer is not waiting for MP to respond to playback pause request, and
            // if the reducer is not waiting for the AVR to respond to audio volume request
            if (
              !avrVolumeStatus.length ||
              avrService.isAvrVolumeStatsValid(avrVolumeStatus)
            ) {
              // then initiate the audio switch sequence
              return initiateAudioSourceSwitch(appState, cecClientEvent);
            }

            const _avrVolumeStatus =
              avrService.decodeAvrVolumeStatus(cecClientEvent);

            // if the CEC transmission is not regarding audio turning off, and
            // if the reducer is not waiting for MP to respond to playback pause request, and
            // if the reducer is waiting for the AVR to respond to audio volume request, and
            // if the CEC transmission is not regarding AVR responding to audio volume request
            if (!avrService.isAvrVolumeStatsValid(_avrVolumeStatus)) {
              // then no-op
              return acc;
            }

            const { state } = /** @type AppState */ appState;

            // if the CEC transmission is not regarding audio turning off, and
            // if the reducer is not waiting for MP to respond to playback pause request, and
            // if the reducer is waiting for the AVR to respond to audio volume request, and
            // if the CEC transmission is regarding AVR responding to audio volume request, and
            // if MP is playing
            if (playRegExp.test(state)) {
              // then ask MP to pause
              avrService.updateOsd('pause');
              /**
               * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
               */
              setTimeout(() => mpService.pause(), 500);
              return [_avrVolumeStatus, [state, undefined]];
            }

            // if the CEC transmission is not regarding audio turning off, and
            // if the reducer is not waiting for MP to respond to playback pause request, and
            // if the reducer is waiting for the AVR to respond to audio volume request, and
            // if the CEC transmission is regarding AVR responding to audio volume request, and
            // if MP is not playing,
            // then do not ask MP to pause and switch audio source directly
            switchingAudioSource(_avrVolumeStatus);
            return [_avrVolumeStatus, [state, state]];

          case 'mpClient':
            // if the reducer is not waiting for MP to respond to playback pause request
            if (!fromMpStatusState || toMpStatusState) {
              // then reset the reducer
              return getInitState();
            }

            const { data: mpStatus } = /** @type MpClientEvent */ event;

            // if the reducer is waiting for MP to respond to playback pause request, and
            // if MP decides to keep playing
            if (playRegExp.test(mpStatus.state)) {
              // then reset the reducer
              return getInitState();
            }

            // if the reducer is waiting for MP to respond to playback pause request, and
            // if MP confirms playback is paused,
            // then switch the audio source
            /**
             * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
             */
            setTimeout(() => switchingAudioSource(avrVolumeStatus), 500);
            return [avrVolumeStatus, [fromMpStatusState, mpStatus.state]];

          default:
            return getInitState();
        }
      },
      getInitState(),
    ];
  })(_appConfig);
};

module.exports = AvrAudioSourceSwitchReducer;
