import { customerSearchTerm } from './customers-source';

describe('customerSearchTerm', () => {
  it('quotes the term, which the endpoint needs for a digit or an @', () => {
    expect(customerSearchTerm('maria@example.com')).toBe('"maria@example.com"');
  });

  it('folds a name, so a capital Σ still finds the final ς', () => {
    expect(customerSearchTerm('  ΓΙΏΡΓΟΣ ')).toBe('"γιωργος"');
  });

  it('sends a phone as bare digits, as the API stores it', () => {
    expect(customerSearchTerm('+30 697-712 3456')).toBe('"306977123456"');
    expect(customerSearchTerm('(697) 712 34')).toBe('"69771234"');
  });

  it('escapes a quote and a backslash inside the phrase', () => {
    expect(customerSearchTerm('o"brien\\')).toBe('"o\\"brien\\\\"');
  });

  it('has nothing to search for blank input', () => {
    expect(customerSearchTerm('   ')).toBe('');
  });
});
