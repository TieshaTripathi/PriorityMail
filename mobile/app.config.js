const fs = require('node:fs');
const path = require('node:path');

// Activate supplied artwork without breaking Expo Go while placeholders are absent.
module.exports = ({ config }) => {
  const present = name => fs.existsSync(path.join(__dirname, 'assets', name));
  const plugins = [...(config.plugins || []), ['expo-splash-screen', {
    backgroundColor: '#FFFFFF',
    ...(present('splash.png') ? { image: './assets/splash.png', imageWidth: 200, resizeMode: 'contain' } : {}),
  }]];
  return {
    ...config,
    ...(present('icon.png') ? { icon: './assets/icon.png' } : {}),
    android: {
      ...config.android,
      adaptiveIcon: {
        ...config.android?.adaptiveIcon,
        ...(present('adaptive-icon.png') ? { foregroundImage: './assets/adaptive-icon.png' } : {}),
      },
    },
    plugins,
  };
};
