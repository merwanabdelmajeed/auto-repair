import { missingFieldsMessage } from './missingFields';

describe('missingFieldsMessage', () => {
  it('names only the empty fields', () => {
    expect(missingFieldsMessage({ Year: '2003', Make: 'HONDA', Model: 'Accord', Color: '' })).toBe('Color is required.');
    expect(missingFieldsMessage({ Year: ' ', Make: 'HONDA', Model: 'Accord', Color: '' })).toBe('Year and color are required.');
    expect(missingFieldsMessage({ Year: '', Make: '', Model: 'Accord', Color: '' })).toBe('Year, make, and color are required.');
    expect(missingFieldsMessage({ Year: '', Make: '', Model: '', Color: '' })).toBe('Year, make, model, and color are required.');
  });

  it('returns an empty string when nothing is missing', () => {
    expect(missingFieldsMessage({ Year: '2003', Make: 'HONDA' })).toBe('');
  });
});
