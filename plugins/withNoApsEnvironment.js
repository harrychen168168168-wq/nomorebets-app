const { withEntitlementsPlist } = require('expo/config-plugins');

// expo-notifications auto-applies its config plugin (Expo SDK 50+ applies installed packages'
// plugins automatically) and adds the `aps-environment` remote-push entitlement. This app uses
// LOCAL notifications only — no APNs / push server — so we strip that entitlement. Keeping it would
// (a) require the App Store provisioning profile to carry the Push Notifications capability, which
// it doesn't, breaking manual code signing in CI, and (b) wrongly declare remote push to Apple.
module.exports = function withNoApsEnvironment(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
