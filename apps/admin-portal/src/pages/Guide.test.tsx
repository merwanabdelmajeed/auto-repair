import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Guide from './Guide';

// The real asset is a multi-MB inlined HTML document; mock it so the test stays fast.
vi.mock('../assets/owner-guide.html?raw', () => ({ default: '<html><body>Guide</body></html>' }));

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock-guide');
  URL.revokeObjectURL = vi.fn();
});

describe('Guide', () => {
  it('renders the guide document in an iframe fed from an in-memory blob URL', async () => {
    render(<Guide />);
    const frame = screen.getByTitle("Owner's Guide") as HTMLIFrameElement;
    expect(frame).toBeInTheDocument();
    await waitFor(() => expect(frame.getAttribute('src')).toBe('blob:mock-guide'));
    // built from the bundled document, never from a rewritable static path
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('offers an "open in new tab" link to the same blob document', async () => {
    render(<Guide />);
    const link = screen.getByRole('link', { name: /open in new tab/i });
    await waitFor(() => expect(link).toHaveAttribute('href', 'blob:mock-guide'));
    expect(link).toHaveAttribute('target', '_blank');
  });
});
