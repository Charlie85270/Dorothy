const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;

  // Use keychain profile if available, otherwise fall back to env vars
  const useKeychain = !process.env.APPLE_ID;

  console.log(`Notarizing ${appName}.app...`);

  if (useKeychain) {
    await notarize({
      appPath: `${appOutDir}/${appName}.app`,
      keychainProfile: 'Dorothy',
    });
  } else {
    await notarize({
      appPath: `${appOutDir}/${appName}.app`,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    });
  }

  console.log('Notarization complete');
};
