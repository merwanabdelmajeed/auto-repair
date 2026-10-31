// Every handler calls authenticate(), which for admin callers reads the
// caller's USERS row on each request. Handler tests mock GetCommand with one
// blanket response for whatever *they* are fetching, so that lookup would get
// the wrong item. Stub it to "active, no overrides" everywhere; the real
// lookup and the rejection paths are covered in shared/middleware tests.
jest.mock('./src/shared/middleware/userRecord', () => ({
  getUserRecord: jest.fn(async () => ({ status: 'ACTIVE' })),
}));
