const { parse, join } = require('path');

const { root } = parse(process.cwd());
const mpdConfPath = join(root, 'etc', 'mpd.conf');
const mpdHost = 'localhost';
const mpdPortFallback = '6600';

const getRxRegExp = (hex) =>
  new RegExp(`^TRAFFIC:\\s*\\[\\s*(\\d+)\\s*\\]\\s*>>\\s*${hex}\\s*`, 'i');

module.exports = {
  mpdConfPath,
  mpdHost,
  mpdPortFallback,
  avrRequestDisplayNameRegExp: getRxRegExp('51:46'),
  avrTurnOnRegExp: getRxRegExp('5f:72:01'),
  avrStandByRegExp: getRxRegExp('5f:72:00'),
  avrIsOnRegExp: getRxRegExp('51:90:00'),
  avrIsStandByRegExp: getRxRegExp('51:90:01'),
  arrowUpKeyupRegExp: getRxRegExp('51:8b:02'),
  arrowDownKeyupRegExp: getRxRegExp('51:8b:01'),
  enterKeyupRegExp: getRxRegExp('51:8b:00'),
  returnKeyupRegExp: getRxRegExp('51:8b:0d'),
  playKeyupRegExp: getRxRegExp('51:8b:44'),
  pauseKeyupRegExp: getRxRegExp('51:8b:46'),
  stopKeyupRegExp: getRxRegExp('51:8b:45'),
  nextKeyupRegExp: getRxRegExp('51:8b:4b'),
  previousKeyupRegExp: getRxRegExp('51:8b:4c'),
  blueFunctionKeyupRegExp: getRxRegExp('51:8b:71'),
  redFunctionKeyupRegExp: getRxRegExp('51:8b:72'),
  greenFunctionKeyupRegExp: getRxRegExp('51:8b:73'),
  yellowFunctionKeyupRegExp: getRxRegExp('51:8b:74'),
  volumeStatusRegExp: getRxRegExp('(51:7A:)((?:[0-9a-fA-F]{2}:?)+)'),
  mpdPortSettingRegExp: /^port.*"([^"]+)"/, // MPD port
  playlistFoldersBasePathSettingRegExp: /^music_directory.*"([^"]+)"/, // path to a directory that contains song folders
  playlistFilesBasePathSettingRegExp: /^playlist_directory.*"([^"]+)"/, // path to a directory that contains .m3u playlist files
  playOrPauseRegExp: /(play|pause)/i,
  playRegExp: /play/i,
  pauseRegExp: /pause/i,
  stopRegExp: /stop/i,
};
