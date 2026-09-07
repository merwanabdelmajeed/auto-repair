import { render, screen } from '@testing-library/react';
import Guide from './Guide';

describe('Guide', () => {
  it('renders the guide document in an iframe pointing at the static asset', () => {
    render(<Guide />);
    const frame = screen.getByTitle("Owner's Guide") as HTMLIFrameElement;
    expect(frame).toBeInTheDocument();
    expect(frame.getAttribute('src')).toBe('/owner-guide.html');
  });

  it('offers an "open in new tab" link to the same document', () => {
    render(<Guide />);
    const link = screen.getByRole('link', { name: /open in new tab/i });
    expect(link).toHaveAttribute('href', '/owner-guide.html');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
