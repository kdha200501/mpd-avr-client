/**
 * @typedef {{
 * isAudioDeviceOn: boolean,
 * state: string,
 * showPlaylist: boolean,
 * playlistIdx: number,
 * playlists: string[],
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
 * @typedef {string} CecTransmission
 */

/**
 * @typedef {{
 * source: 'cecClient',
 * data: CecTransmission,
 * }} CecClientEvent
 */
