const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// React Native 0.76's vendored `fmt` pod fails to compile under Xcode 26's
// stricter C++20 consteval checking (facebook/react-native#55601). Build the
// fmt pod against C++17 instead, where the offending consteval path doesn't
// exist and fmt falls back to runtime format-string validation. Remove once
// React Native ships a fmt version that builds clean on Xcode 26+.
const MARKER = 'FMT_CONSTEVAL_FIX';

function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(MARKER)) {
        const hook = 'post_install do |installer|';
        const patch = `${hook}
    # ${MARKER}: see plugins/withFmtConstevalFix.js
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;
        contents = contents.replace(hook, patch);
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
}

module.exports = withFmtConstevalFix;
