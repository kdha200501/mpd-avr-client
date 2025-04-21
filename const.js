const getRxRegExp = (hex) =>
  new RegExp(`^TRAFFIC:\\s*\\[\\s*(\\d+)\\s*\\]\\s*>>\\s*${hex}\\s*`);

module.exports = {
  audioDeviceRequestRecorderNameLogRegExp: getRxRegExp('51:46'),
  audioDeviceTurnOnRegExp: getRxRegExp('5f:72:01'),
  audioDeviceStandByRegExp: getRxRegExp('5f:72:00'),
  audioDeviceIsOnRegExp: getRxRegExp('51:90:00'),
  audioDeviceIsStandByRegExp: getRxRegExp('51:90:01'),
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
  playlistFoldersBasePathSettingRegExp: /^music_directory.*"([^"]+)"/, // path to a directory that contains song folders
  playlistFilesBasePathSettingRegExp: /^playlist_directory.*"([^"]+)"/, // path to a directory that contains .m3u playlist files
  playOrPauseRegExp: /(play|pause)/i,
  playRegExp: /play/i,
  stopRegExp: /stop/i,
};
