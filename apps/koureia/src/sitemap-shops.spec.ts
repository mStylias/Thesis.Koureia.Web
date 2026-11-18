import { createSitemapShops } from './sitemap-shops';

const SHOPS = [{ slug: 'barber-house-kolonaki', lastModified: '2026-09-01T10:00:00Z' }];

function answer(status: number, body: unknown = null): Response {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}

describe('createSitemapShops', () => {
  let now: number;

  beforeEach(() => {
    now = 0;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function reader(fetchFn: typeof fetch): () => Promise<unknown> {
    return createSitemapShops({ apiUrl: 'https://api.test', fetch: fetchFn, now: () => now });
  }

  it('reads the shops from the slugs endpoint', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(answer(200, SHOPS));

    await expect(reader(fetchFn)()).resolves.toEqual(SHOPS);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.test/api/v1/companies/slugs',
      expect.anything(),
    );
  });

  it('reads 204 No Content as no shops', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(answer(204));

    await expect(reader(fetchFn)()).resolves.toEqual([]);
  });

  it('asks once per five minutes', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(answer(200, SHOPS)));
    const read = reader(fetchFn);

    await read();
    now = 4 * 60_000;
    await read();
    expect(fetchFn).toHaveBeenCalledTimes(1);

    now = 5 * 60_000;
    await read();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('answers with no shops when the first request fails, so the sitemap still renders', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(answer(500));

    await expect(reader(fetchFn)()).resolves.toEqual([]);
  });

  it('keeps the last good answer when a later request fails', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(answer(200, SHOPS))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const read = reader(fetchFn);

    await read();
    now = 10 * 60_000;

    await expect(read()).resolves.toEqual(SHOPS);
  });
});
