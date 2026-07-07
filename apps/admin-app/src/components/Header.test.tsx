import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { NavigationContainer, useNavigation, DrawerActions } from '@react-navigation/native';
import Header from './Header';

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return { ...actual, useNavigation: jest.fn() };
});

const mockDispatch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useNavigation as jest.Mock).mockReturnValue({ dispatch: mockDispatch });
});

describe('Header', () => {
  it('renders the title', () => {
    render(<NavigationContainer><Header title="Dashboard" /></NavigationContainer>);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('opens the drawer when the menu button is pressed', () => {
    render(<NavigationContainer><Header title="Dashboard" /></NavigationContainer>);
    fireEvent.press(screen.getByTestId('header-menu-btn'));
    expect(mockDispatch).toHaveBeenCalledWith(DrawerActions.openDrawer());
  });

  it('renders a custom rightElement when provided', () => {
    render(<NavigationContainer><Header title="Dashboard" rightElement={<Text>Right</Text>} /></NavigationContainer>);
    expect(screen.getByText('Right')).toBeTruthy();
  });
});
