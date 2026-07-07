import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import Layout from './Layout';

describe('Layout', () => {
  it('renders its children', () => {
    render(<Layout><Text>Content</Text></Layout>);
    expect(screen.getByText('Content')).toBeTruthy();
  });
});
