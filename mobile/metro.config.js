const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16 keeps Tailwind's scale in real pixels (p-4 = 16px), as on the web.
module.exports = withNativeWind(config, { input: './src/global.css', inlineRem: 16 });
