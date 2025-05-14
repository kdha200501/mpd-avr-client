/**
 * @typedef {Object} AppConfig
 * @property {number} osdMaxLength
 * @property {number} audioVolumePreset
 * @property {string} handOverAudioToTvCecCommand
 * @property {number} audioVolumePresetForTv
 * @property {TvLaunchProfileType} braviaLaunchProfile
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
