/**
 * app.json, plus one check: a release build (eas.json's `release` profile) must have the
 * production server and the Google client ID. Without EXPO_PUBLIC_API_URL the app falls back
 * to its built-in sample server, which must never reach real users, so the build stops instead.
 * The values come from the project's EAS environment variables ("production").
 */
const REQUIRED_FOR_RELEASE = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID'];

module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE === 'release') {
    const missing = REQUIRED_FOR_RELEASE.filter((name) => !process.env[name]);
    if (missing.length > 0) {
      throw new Error(
        `Release build needs ${missing.join(' and ')}: add them to the "production" environment ` +
          '(npx eas-cli@latest env:create --environment production).',
      );
    }
    if (!process.env.EXPO_PUBLIC_API_URL.startsWith('https://')) {
      throw new Error('Release build needs EXPO_PUBLIC_API_URL to be an https:// address.');
    }
  }
  return config;
};
