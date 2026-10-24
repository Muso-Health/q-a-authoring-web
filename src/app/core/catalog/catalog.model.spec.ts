import { toValidationStatus } from './catalog.model';

describe('toValidationStatus', () => {
  it('reads the decided states', () => {
    expect(toValidationStatus({ state: 'validated' })).toBe('validated');
    expect(toValidationStatus({ state: 'rejected' })).toBe('rejected');
  });

  it('reads no state as pending, the engine’s meaning of null inside a QASet', () => {
    expect(toValidationStatus(null)).toBe('pending');
    expect(toValidationStatus(undefined)).toBe('pending');
    expect(toValidationStatus({ state: 'pending' })).toBe('pending');
  });
});
