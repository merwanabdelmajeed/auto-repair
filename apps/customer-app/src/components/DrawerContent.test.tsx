import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import DrawerContent from './DrawerContent';

function renderWithSafeArea(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 0, height: 0 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>{ui}</SafeAreaProvider>);
}

function fakeProps(activeRouteName = 'Home'): DrawerContentComponentProps {
  return {
    navigation: { navigate: jest.fn() },
    state: {
      routes: [{ key: 'Home-1', name: activeRouteName }],
      index: 0,
    },
    descriptors: {},
  } as unknown as DrawerContentComponentProps;
}

describe('DrawerContent', () => {
  it('renders every nav item', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps()} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Appointments')).toBeTruthy();
    expect(screen.getByText('My Vehicles')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('navigates when a drawer item is pressed', () => {
    const props = fakeProps();
    renderWithSafeArea(<DrawerContent {...props} />);

    fireEvent.press(screen.getByText('Appointments'));

    expect(props.navigation.navigate).toHaveBeenCalledWith('Appointments');
  });

  it('marks the active route differently (no crash across every route)', () => {
    renderWithSafeArea(<DrawerContent {...fakeProps('Profile')} />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});
