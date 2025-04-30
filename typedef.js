/**
 * @typedef {{
 * osdMaxLength: number
 * audioVolumePreset: number
 * }} AppConfig
 */

/**
 * @typedef {{
 * isAudioDeviceOn: boolean,
 * showPlaylist: boolean,
 * playlistIdx: number,
 * playlists: string[],
 * state: string,
 * song: string,
 * playlistlength: string,
 * elapsed: string,
 * duration: string,
 * repeat: string,
 * random: string,
 * }} AppState
 */

/**
 * @typedef {{
 * repeat: string,
 * random: string,
 * single: string,
 * consume: string,
 * playlist: string,
 * playlistlength: string,
 * elapsed: string,
 * duration: string,
 * mixrampdb: string,
 * state: string,
 * song: string,
 * songid: string,
 * nextsong: string,
 * nextsongid: string,
 * }} MpStatus
 */

/**
 * @typedef {{
 * source: 'mpClient',
 * data: MpStatus,
 * }} MpClientEvent
 */

/**
 * @typedef {Buffer} CecTransmission
 */

/**
 * @typedef {{
 * source: 'cecClient',
 * data: CecTransmission,
 * }} CecClientEvent
 */

/**
 * @typedef {[undefined|boolean]} AvrPowerStatus
 */

/**
 * @typedef {[undefined|string]} AvrVolumeStatus
 */
