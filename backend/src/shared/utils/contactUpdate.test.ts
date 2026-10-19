import { parseContactUpdate, updateExpression, type ContactUpdate } from './contactUpdate';

function ok(body: Record<string, unknown>): ContactUpdate {
  const r = parseContactUpdate(body);
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('parseContactUpdate', () => {
  it('reports no change when neither field is present', () => {
    const r = ok({ firstName: 'x' });
    expect(r.changed).toBe(false);
    expect(r.sets).toEqual([]);
    expect(r.removes).toEqual([]);
  });

  it('sets a trimmed phone', () => {
    const r = ok({ phone: ' (949) 555-1234 ' });
    expect(r.sets).toEqual(['phone = :phone']);
    expect(r.values).toEqual({ ':phone': '(949) 555-1234' });
    expect(r.result).toEqual({ phone: '(949) 555-1234' });
  });

  it('rejects an empty or non-string phone', () => {
    expect(parseContactUpdate({ phone: '  ' })).toEqual({ error: 'phone cannot be empty' });
    expect(parseContactUpdate({ phone: 5 })).toEqual({ error: 'phone cannot be empty' });
  });

  it('sets a sanitized address', () => {
    const r = ok({ address: { line1: ' 1 Main St ', city: 'Irvine', junk: 'x' } });
    expect(r.sets).toEqual(['address = :address']);
    expect(r.values).toEqual({ ':address': { line1: '1 Main St', city: 'Irvine' } });
    expect(r.result).toEqual({ address: { line1: '1 Main St', city: 'Irvine' } });
  });

  it('removes the address when it is null or all blank', () => {
    for (const address of [null, {}, { line1: '  ' }]) {
      const r = ok({ address });
      expect(r.sets).toEqual([]);
      expect(r.removes).toEqual(['address']);
      expect(r.result).toEqual({ address: null });
      expect(r.changed).toBe(true);
    }
  });

  it('rejects a non-object address', () => {
    expect(parseContactUpdate({ address: '1 Main St' })).toEqual({ error: 'address must be an object or null' });
  });
});

describe('updateExpression', () => {
  it('joins SET and REMOVE clauses', () => {
    expect(updateExpression(['a = :a', 'b = :b'], [])).toBe('SET a = :a, b = :b');
    expect(updateExpression(['a = :a'], ['address'])).toBe('SET a = :a REMOVE address');
    expect(updateExpression([], ['address'])).toBe('REMOVE address');
  });
});
