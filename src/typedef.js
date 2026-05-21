/** @typedef {import('rxjs').Observable} Observable */

/**
 * @typedef {Object} MainCommandOptions
 * @property {number} [osdMaxLength] - Maximum number of characters for OSD display (default: 14)
 * @property {number} [audioVolumePreset] - Audio volume (0-100) target when AVR wakes up
 * @property {string} [handOverAudioToTvCecCommand] - CEC command for AVR to switch audio source to TV via non-HDMI input
 * @property {string} [infraredDevice] - Path to infrared device
 * @property {number} [audioVolumePresetForTv] - Audio volume target when AVR switches audio source to TV
 * @property {string} [infraredRemoteControlMappingForTv] - Path to infrared remote control key mapping for TV
 * @property {string} [braviaLaunchProfile] - Path to launch profile for Sony Bravia TV
 * @property {string} [goveeLaunchProfile] - Path to launch profile for Govee LED strip
 */

/**
 * @typedef {Object} MapKeysCommandOptions
 * @property {string} infraredDevice - Path to infrared device
 * @property {string} [directory] - Working directory for the command (default: current directory)
 * @property {string} [braviaLaunchProfile] - Path to launch profile for Sony Bravia TV when mapping remote control buttons
 */

/**
 * @typedef {Object} TVService
 * @property {function(): boolean} isEnabled
 * @property {function(): void} wakeAndLaunchApp
 * @property {function(): void} standBy
 * @property {function(string): void} sendIrccCode
 * @property {function(): import('rxjs').Observable<[string, string][]>} getButtonIrccCodePairs
 */

/**
 * @typedef {Object} LedService
 * @property {function(): boolean} isEnabled
 * @property {function(): void} wake
 * @property {function(): void} standBy
 */

/**
 * @typedef {Object} AppState
 * @property {boolean} isAudioDeviceOn
 * @property {boolean} showPlaylist
 * @property {number} playlistIdx
 * @property {string[]} playlists
 * @property {string} state
 * @property {string} song
 * @property {string} playlistlength
 * @property {string} elapsed
 * @property {string} duration
 * @property {string} repeat
 * @property {string} random
 */

/**
 * @typedef {Object} MpStatus
 * @property {string} repeat
 * @property {string} random
 * @property {string} single
 * @property {string} consume
 * @property {string} playlist
 * @property {string} playlistlength
 * @property {string} elapsed
 * @property {string} duration
 * @property {string} mixrampdb
 * @property {string} state
 * @property {string} song
 * @property {string} songid
 * @property {string} nextsong
 * @property {string} nextsongid
 */

/**
 * @typedef {Object} MpClientEvent
 * @property {'mpClient'} source
 * @property {MpStatus} data
 */

/**
 * @typedef {Buffer} CecTransmission
 */

/**
 * @typedef {Object} CecClientEvent
 * @property {'cecClient'} source
 * @property {CecTransmission} data
 */

/**
 * @typedef {Object} LircClientEvent
 * @property {'lircClient'} source
 * @property {string} data
 */

/**
 * @typedef {[undefined|boolean]} AvrPowerStatus
 */

/**
 * @typedef {[undefined|string]} AvrVolumeStatus
 */

/**
 * @typedef {[undefined|string, undefined|string]} MpStatusStateTransition
 */

/**
 * @typedef {Dict<unknown>} HttpObject
 */

/**
 * @typedef {'BRAVIA'} TvType
 */

/**
 * @typedef {'braviaLaunchProfile'} TvLaunchProfileType
 */

/**
 * @typedef {Object} TvLaunchProfile
 * @property {string} hostname
 * @property {string} appTitle
 */

/**
 * @typedef {TvLaunchProfile} BraviaLaunchProfile
 * @property {string} preSharedKey The value under Settings -> IP control -> Pre-Shared Key
 */

/**
 * @typedef {Object} BraviaPayload
 * @property {string} method
 * @property {HttpObject[]} params
 * @property {number} id
 * @property {string} version
 */

/**
 * @typedef {Object} BraviaResponse
 * @property {HttpObject[]} result
 * @property {string[]} error
 * @property {number} id
 */

/**
 * @typedef {Object} BraviaApp
 * @property {string} title
 * @property {string} uri
 * @property {string} icon
 */

/**
 * @typedef {Object} BraviaRemoteControllerButton
 * @property {string} name
 * @property {string} value
 */

/**
 * @typedef {Object} BraviaRemoteControllerMeta
 * @property {boolean} bundled
 * @property {string} type
 */

/**
 * @typedef {'GOVEE'} LedType
 */

/**
 * @typedef {'goveeLaunchProfile'} LedLaunchProfileType
 */

/**
 * @typedef {Object} LedLaunchProfile
 */

/**
 * @typedef {LedLaunchProfile} GoveeLaunchProfile
 * @property {string} macAddress
 * @property {string} rowNumberHex
 */
