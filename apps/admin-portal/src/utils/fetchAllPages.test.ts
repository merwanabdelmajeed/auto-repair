import { fetchAllPages } from './fetchAllPages';

describe('fetchAllPages', () => {
  it('returns all items from a single page', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [1, 2, 3], nextCursor: null });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([1, 2, 3]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(null);
  });

  it('follows cursors across multiple pages and concatenates items in order', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [1, 2], nextCursor: 'c1' })
      .mockResolvedValueOnce({ items: [3, 4], nextCursor: 'c2' })
      .mockResolvedValueOnce({ items: [5], nextCursor: null });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage).toHaveBeenNthCalledWith(1, null);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'c1');
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'c2');
  });

  it('returns an empty array when the first page is empty', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    await expect(fetchAllPages(fetchPage)).resolves.toEqual([]);
  });
});
