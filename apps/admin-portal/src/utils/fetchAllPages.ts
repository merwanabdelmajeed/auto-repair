interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

// Loops through every page of a cursor-paginated endpoint and returns the
// complete list. Used where a page needs the full data set client-side
// (cross-reference maps, date-based filtering that can't assume any
// particular page ordering) rather than true incremental pagination — the
// network payload is still chunked per request either way.
export async function fetchAllPages<T>(fetchPage: (cursor: string | null) => Promise<Page<T>>): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  do {
    const { items, nextCursor } = await fetchPage(cursor);
    all.push(...items);
    cursor = nextCursor;
  } while (cursor);
  return all;
}
