// Required by react-native-gesture-handler for any test that touches a component
// using it under the hood (react-navigation's Drawer navigator does) — without
// this, the native module's `install()` call throws in the test environment.
import 'react-native-gesture-handler/jestSetup';

// @expo/vector-icons' Ionicons relies on expo-font's native font-loading state,
// which jest-expo's default mocks don't fully satisfy (loadedNativeFonts.forEach
// is not a function) — render a plain stub instead so any screen/component using
// icons can be tested without touching real font loading.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function IconStub(props) {
    return React.createElement(Text, props, props.name);
  }
  return {
    Ionicons: IconStub,
    glyphMap: {},
  };
});
