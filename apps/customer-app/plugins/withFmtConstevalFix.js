const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

// React Native 0.76's vendored `fmt` library fails to compile under Xcode
// 26.4+'s stricter C++20 consteval checking (facebook/react-native#55601).
// The offending template is instantiated wherever fmt::format() is called
// (inside RCT-Folly, React-Fabric, glog, etc.), not inside the `fmt` pod's
// own compiled files, so the fix has to disable fmt's consteval code path
// project-wide via a preprocessor define, not just on the `fmt` target.
// Remove once React Native ships a fmt version that builds clean on Xcode 26+.
const MARKER = 'FMT_CONSTEVAL_FIX';

function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (!contents.includes(MARKER)) {
        // Must run AFTER react_native_post_install(...) returns: that helper
        // sets CLANG_CXX_LANGUAGE_STANDARD project-wide and would otherwise
        // clobber this override if we ran first.
        const callRegex = /(react_native_post_install\([\s\S]*?\n {4}\)\n)/;
        const patch = `    # ${MARKER}: see plugins/withFmtConstevalFix.js
    installer.pods_project.targets.each do |target|
      if target.name == 'fmt'
        target.build_configurations.each do |config|
          config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'c++17'
        end
      end
    end
`;
        if (!callRegex.test(contents)) {
          throw new Error(
            'withFmtConstevalFix: could not find react_native_post_install(...) call in Podfile to patch after.'
          );
        }
        contents = contents.replace(callRegex, `$1\n${patch}`);
        fs.writeFileSync(podfilePath, contents);
      }

      return config;
    },
  ]);
}

module.exports = withFmtConstevalFix;
