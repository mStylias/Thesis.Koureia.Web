import { TestBed } from '@angular/core/testing';
import { provideBrand } from '@util/brand';

import { BookingDraftStore, DRAFT_MAX_AGE_MS } from './booking-draft.store';
import { bookingDraft } from './booking.fixture';

const SLUG = 'barber-house-kolonaki';

/** A brand, so the draft keys are namespaced the way they are in an app. */
const FAKE_BRAND = {
  id: 'barbershop-x',
  name: 'Barbershop X',
  wordmark: 'barbershop-x',
  logo: '/brand/barbershop-x-icon.png',
  heroImage: '/images/barbershop-x-hero.webp',
  defaultTheme: 'light',
} as const;

// The prefix the store builds from the brand. Spelled out here so a change to either is caught.
const KEY = `barbershop-x.booking.draft.v1.${SLUG}`;

describe('BookingDraftStore', () => {
  let store: BookingDraftStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideBrand(FAKE_BRAND)] });
    store = TestBed.inject(BookingDraftStore);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a draft', () => {
    const draft = bookingDraft({ serviceIds: ['a', 'b'], staffMemberId: 'barber-a', step: 'when' });

    store.save(draft);

    expect(store.load(SLUG)).toMatchObject({
      slug: SLUG,
      serviceIds: ['a', 'b'],
      staffMemberId: 'barber-a',
      step: 'when',
    });
  });

  it('stamps savedAt on every save, so the caller never has to', () => {
    store.save(bookingDraft({ savedAt: '2020-01-01T00:00:00.000Z' }));

    const saved = store.load(SLUG);
    expect(saved).not.toBeNull();
    expect(Date.parse(saved?.savedAt ?? '')).toBeGreaterThan(Date.parse('2024-01-01T00:00:00Z'));
  });

  it('drops an entry written by an older shape', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...bookingDraft(), version: 99, savedAt: new Date().toISOString() }),
    );

    expect(store.load(SLUG)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('drops an entry older than six hours', () => {
    const stale = new Date(Date.now() - DRAFT_MAX_AGE_MS - 1000).toISOString();
    localStorage.setItem(KEY, JSON.stringify({ ...bookingDraft(), version: 1, savedAt: stale }));

    expect(store.load(SLUG)).toBeNull();
  });

  it('keeps an entry just inside six hours', () => {
    const fresh = new Date(Date.now() - DRAFT_MAX_AGE_MS + 60_000).toISOString();
    localStorage.setItem(KEY, JSON.stringify({ ...bookingDraft(), version: 1, savedAt: fresh }));

    expect(store.load(SLUG)).not.toBeNull();
  });

  it('drops an unreadable entry rather than answering null forever', () => {
    localStorage.setItem(KEY, 'not json');

    expect(store.load(SLUG)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('refuses an entry whose slug does not match its key', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...bookingDraft({ slug: 'somewhere-else' }),
        version: 1,
        savedAt: new Date().toISOString(),
      }),
    );

    expect(store.load(SLUG)).toBeNull();
  });

  it('keeps one draft per shop', () => {
    store.save(bookingDraft({ slug: 'shop-a', serviceIds: ['a'] }));
    store.save(bookingDraft({ slug: 'shop-b', serviceIds: ['b'] }));

    expect(store.load('shop-a')?.serviceIds).toEqual(['a']);
    expect(store.load('shop-b')?.serviceIds).toEqual(['b']);
  });

  it('sweeps expired drafts of other shops on load', () => {
    const stale = new Date(Date.now() - DRAFT_MAX_AGE_MS - 1000).toISOString();
    localStorage.setItem(
      'barbershop-x.booking.draft.v1.shop-elsewhere',
      JSON.stringify({ ...bookingDraft({ slug: 'shop-elsewhere' }), version: 1, savedAt: stale }),
    );
    store.save(bookingDraft());

    store.load(SLUG);

    expect(localStorage.getItem('barbershop-x.booking.draft.v1.shop-elsewhere')).toBeNull();
  });

  it('leaves other keys alone', () => {
    localStorage.setItem('unrelated', 'keep me');
    store.save(bookingDraft());

    store.load(SLUG);

    expect(localStorage.getItem('unrelated')).toBe('keep me');
  });

  it('survives a localStorage that refuses to write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    // The booking must still be possible without a draft, so this must not throw.
    expect(() => {
      store.save(bookingDraft());
    }).not.toThrow();
  });

  it('survives a localStorage that refuses to read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(store.load(SLUG)).toBeNull();
  });

  it('clears one shop', () => {
    store.save(bookingDraft());

    store.clear(SLUG);

    expect(store.load(SLUG)).toBeNull();
  });
});
