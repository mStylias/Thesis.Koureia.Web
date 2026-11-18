import { formatPhone } from './phone-format';

describe('formatPhone', () => {
  it('groups a Greek number and keeps any other as stored', () => {
    expect(formatPhone('+306900000001')).toBe('+30 690 000 0001');
    expect(formatPhone('+30 2101234567')).toBe('+30 210 123 4567');
    expect(formatPhone('+447911123456')).toBe('+447911123456');
    expect(formatPhone('+3069000')).toBe('+3069000');
  });
});
