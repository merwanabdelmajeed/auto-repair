import { sortServices } from './sortServices';

function service(overrides: Partial<Parameters<typeof sortServices>[0][number]> = {}) {
  return { serviceId: 's', name: 'Service', description: '', isActive: true, ...overrides };
}

describe('sortServices', () => {
  it('puts oil change, smog, and check-engine services first, in that priority order', () => {
    const result = sortServices([
      service({ serviceId: 'susp', name: 'Suspension' }),
      service({ serviceId: 'smog', name: 'Certified Smog Test' }),
      service({ serviceId: 'oil', name: 'Oil Change' }),
      service({ serviceId: 'cel', name: 'Check Engine Light Diagnostic' }),
    ]);

    expect(result.map(s => s.serviceId)).toEqual(['oil', 'smog', 'cel', 'susp']);
  });

  it('ranks other curated keywords ahead of unrecognized services', () => {
    const result = sortServices([
      service({ serviceId: 'unknown', name: 'Something Unusual' }),
      service({ serviceId: 'brake', name: 'Brake Inspection' }),
    ]);

    expect(result.map(s => s.serviceId)).toEqual(['brake', 'unknown']);
  });

  it('breaks ties within the same priority tier alphabetically by name', () => {
    const result = sortServices([
      service({ serviceId: 'b', name: 'Bbb Unrecognized' }),
      service({ serviceId: 'a', name: 'Aaa Unrecognized' }),
    ]);

    expect(result.map(s => s.serviceId)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const input = [service({ serviceId: 'b', name: 'B' }), service({ serviceId: 'a', name: 'A' })];
    const copy = [...input];

    sortServices(input);

    expect(input).toEqual(copy);
  });
});
