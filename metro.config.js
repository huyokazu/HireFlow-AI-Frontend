const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// backend/ is the Next.js API with its own node_modules; keep it out of the app bundle and watcher.
config.resolver.blockList = [/[\\/]backend[\\/].*/];

module.exports = withNativeWind(config, { input: './global.css' });
