const { of } = require('rxjs');
const { delay, switchMap, take } = require('rxjs/operators');

const { playRegExp } = require('../const');
const AvrService = require('../services/avr-service');
const MpService = require('../services/mp-service');
const TvRemoteService = require('../services/tv-remote-service');
const tvServiceFactory = require('../services/tv-service-factory');
const ledServiceFactory = require('../services/led-service-factory');

const AvrAudioSourceSwitchReducer = function (_commandOptions) {
  return ((commandOptions) => {
    const { handOverAudioToTvCecCommand, audioVolumePresetForTv } =
      /** @type {MainCommandOptions} */ commandOptions;

    const avrService = new AvrService(commandOptions);
    const mpService = new MpService();
    const tvRemoteService = new TvRemoteService(commandOptions);
    const tvService = tvServiceFactory(commandOptions);
    const ledService = ledServiceFactory(commandOptions);

    /**
     * Get the initial state
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} The initial state
     */
    const getInitState = () => [[], [undefined, undefined]];

    /**
     * Request the AVR audio volume
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} The AVR volume request state
     */
    const onRequestAudioVolume = () => {
      avrService.requestAudioVolume();
      return [[undefined], [undefined, undefined]];
    };

    /**
     * Handle the pause action
     * @param {AppState} appState The current MPD playback state
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR audio volume status
     * @returns {[AvrVolumeStatus, MpStatusStateTransition]} Returns a tuple with the AVR volume status and the MP status states
     */
    const onPause = ({ state }, avrVolumeStatus) => {
      if (playRegExp.test(state)) {
        avrService.updateOsd('pause');
        /**
         * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
         */
        setTimeout(() => mpService.pause(), 500);
        return [avrVolumeStatus, [state, undefined]];
      }

      switchAudioSource(avrVolumeStatus);
      return [avrVolumeStatus, [state, state]];
    };

    /**
     * Switch audio source
     * @param {AvrVolumeStatus} avrVolumeStatus The current AVR Audio Status
     * @returns {void} No output
     */
    const switchAudioSource = (avrVolumeStatus) => {
      avrService.runCommand(handOverAudioToTvCecCommand);

      if (tvService.isEnabled()) {
        tvService.wakeAndLaunchApp();
      }

      if (ledService.isEnabled()) {
        ledService.wake();
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
        const { isAudioDeviceOn } = /** @type {AppState} */ appState;

        if (!isAudioDeviceOn) {
          return acc;
        }

        const [avrVolumeStatus, [fromMpStatusState, toMpStatusState]] =
          /** @type {[AvrVolumeStatus, MpStatusStateTransition]} */ acc;
        const { source } =
          /** @type {CecClientEvent|MpClientEvent|LircClientEvent} */ event;

        switch (source) {
          case 'cecClient':
            const cecClientEvent = /** @type CecClientEvent */ event;

            const [_isAudioDeviceOn] =
              avrService.decodeAvrPowerStatus(cecClientEvent);

            // if the CEC transmission is regarding AVR toggling sleep mode
            if (_isAudioDeviceOn !== undefined) {
              // then reset the reducer and request the TV and LED strip to go to sleep
              tvService.isEnabled() && tvService.standBy();
              ledService.isEnabled() && ledService.standBy();
              return getInitState();
            }

            // if the CEC transmission is not regarding AVR toggling sleep mode, and
            // if the reducer is in the middle of pausing, or if the reducer has completed pausing playback
            if (fromMpStatusState) {
              // then ignore the CEC transmission
              return acc;
            }

            // if the CEC transmission is not regarding AVR toggling sleep mode, and
            // if the reducer has not requested a pause on playback, and
            // if the reducer has not requested the AVR volume
            if (!avrVolumeStatus.length) {
              // then handle the CEC transmission as a potential request for AVR volume
              return avrService.isAvrRequestSwitchAudioSource(cecClientEvent)
                ? onRequestAudioVolume()
                : getInitState();
            }

            const _avrVolumeStatus =
              avrService.decodeAvrVolumeStatus(cecClientEvent);

            // if the CEC transmission is not regarding AVR toggling sleep mode, and
            // if the reducer has not requested a pause on playback, and
            // if the reducer has requested the AVR volume, and
            // if the reducer has not received an AVR volume response,
            // then handle the CEC transmission as a potential AVR volume response
            return avrService.isAvrVolumeStatsValid(_avrVolumeStatus)
              ? onPause(appState, _avrVolumeStatus)
              : acc;

          case 'mpClient':
            const mpClientEvent = /** @type MpClientEvent */ event;

            // if the audio source has been switched
            if (fromMpStatusState && toMpStatusState) {
              // then ignore the MP status
              return acc;
            }

            // if the audio source has not been switched, and
            // if the reducer has not requested a pause on the playback
            if (!fromMpStatusState) {
              // then reset the reducer
              return getInitState();
            }

            const { data: mpStatus } = mpClientEvent;

            // if the audio source has not been switched, and
            // if the reducer has requested a pause on the playback, and
            // if MPD decides to keep playing
            if (playRegExp.test(mpStatus.state)) {
              // then reset the reducer
              return getInitState();
            }

            // if the audio source has not been switched, and
            // if the reducer has requested a pause on the playback, and
            // if MPD confirms playback is paused,
            // then switch the audio source
            /**
             * @desc Unfortunately, there is a mysterious incompatibility issue between cec-client and netcat that prevents sending commands to them in proximity, some magic number is used here
             */
            setTimeout(() => switchAudioSource(avrVolumeStatus), 500);
            return [avrVolumeStatus, [fromMpStatusState, mpStatus.state]];

          case 'lircClient':
            const lircClientEvent = /** @type LircClientEvent */ event;

            // if the audio source has not switched
            if (!fromMpStatusState || !toMpStatusState) {
              // then no-op
              return acc;
            }

            const { data: lircCode } = lircClientEvent;

            // if the audio source has switched,
            // then handle the infrared transmission
            tvService.isEnabled() &&
              tvRemoteService
                .getLircCodeIrccCodeMap()
                .subscribe((lircCodeIrccCodeMap) => {
                  const irccCode = lircCodeIrccCodeMap.get(lircCode);

                  if (!irccCode) {
                    return;
                  }

                  tvService.sendIrccCode(irccCode);
                });
            return acc;

          default:
            return getInitState();
        }
      },
      getInitState(),
    ];
  })(_commandOptions);
};

module.exports = AvrAudioSourceSwitchReducer;
