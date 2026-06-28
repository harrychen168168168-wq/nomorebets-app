const { withPodfile } = require('expo/config-plugins');

// GoogleSignin is a Swift pod whose deps don't define modules, so it can't integrate as a plain
// static library (that's why build 22's `pod install` failed). The usual quick fix is
// `useFrameworks: "static"`, but switching the whole app to dynamic/static *frameworks* made the
// app build yet crash at launch on the New Architecture. `use_modular_headers!` is the gentler fix:
// it keeps the default static-library linkage (like the last known-good build) and only generates
// module maps so the Swift pod compiles. Inserted right after the Podfile's `platform :ios` line.
module.exports = function withModularHeaders(config) {
  return withPodfile(config, (cfg) => {
    const contents = cfg.modResults.contents;
    if (!contents.includes('use_modular_headers!')) {
      cfg.modResults.contents = contents.replace(/(platform :ios[^\n]*\n)/, '$1use_modular_headers!\n');
    }
    return cfg;
  });
};
