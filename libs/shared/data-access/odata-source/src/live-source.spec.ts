/**
 * The binding's own emitted queries, answered by a running endpoint.
 *
 * **Skipped unless `ODATA_LIVE=1`.** It needs the Docker stack up, a seeded company and a
 * `roles:read` grant, so it cannot run in CI — but it is the only test that proves the query
 * strings are ones a real server accepts, which no fake can. Everything else in this lib is
 * asserted against `odata-query`'s output; this is asserted against the server.
 *
 * ```bash
 * ODATA_LIVE=1 npx nx test shared-data-access-odata-source --skip-nx-cache
 * ```
 *
 * The fixture it expects is `odata-probe@example.com` on the staff of one company
 * (`aaaa0000-…-cafe`) with a `company_admin` grant, and the four seeded system roles. The API
 * resolves the company from the account, so the URL names none.
 */
import { Observable } from 'rxjs';
import {
  odataQueryString,
  parseHttpError,
  type HttpError,
  type ODataPage,
  type ODataResult,
  type ODataRow,
  type Result,
} from '@synax/client/core';
import { odataSource } from './odata-source';
import type { ODataSourceFetch, UnsupportedReport } from './options';

/** The live stack is opt-in: absent, the whole suite is skipped rather than failing. */
const LIVE = process.env['ODATA_LIVE'] === '1';

const API = process.env['ODATA_LIVE_API'] ?? 'http://localhost:7000';
const KEYCLOAK = process.env['ODATA_LIVE_KEYCLOAK'] ?? 'http://localhost:7030';
const URL = `${API}/api/v1/roles/odata`;

interface RoleODataResponse {
  id: string;
  name: string;
  isSystem: boolean;
  numberOfUsers: number;
}

let token = '';

async function getToken(): Promise<string> {
  const response = await fetch(`${KEYCLOAK}/realms/koureia/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'koureia-spa',
      grant_type: 'password',
      username: 'odata-probe@example.com',
      password: 'Passw0rd!',
      scope: 'openid',
    }),
  });
  const body = (await response.json()) as { access_token: string };
  return body.access_token;
}

/** Every emitted query string, so the assertions can show what actually went out. */
const emitted: string[] = [];

/**
 * The app's half of the contract, over `fetch` rather than `HttpClient`.
 *
 * Note the query string is **appended to the URL**. Handing it to a params encoder would
 * encode it a second time and the server would search for the literal `%CE%B1`.
 */
const liveFetch: ODataSourceFetch<RoleODataResponse> = (query) => {
  const queryString = odataQueryString(query);
  emitted.push(queryString);

  return new Observable<Result<ODataResult<ODataRow>, HttpError>>((subscriber) => {
    const controller = new AbortController();
    void fetch(URL + queryString, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) {
          subscriber.next({
            isSuccess: false,
            error: parseHttpError(response.status, body),
          } as Result<ODataResult<ODataRow>, HttpError>);
        } else {
          const page = body as ODataPage<ODataRow>;
          subscriber.next({
            isSuccess: true,
            data: {
              items: page.value,
              totalCount: page['@odata.count'] ?? null,
              ...(page['@odata.nextLink'] === undefined
                ? {}
                : { nextLink: page['@odata.nextLink'] }),
            },
          } as Result<ODataResult<ODataRow>, HttpError>);
        }
        subscriber.complete();
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          subscriber.error(cause);
        }
      });
    return () => {
      controller.abort();
    };
  });
};

const reports: UnsupportedReport[] = [];

function source(capabilities?: { search?: boolean; apply?: boolean; maxTop?: number }) {
  return odataSource<RoleODataResponse>({
    fetch: liveFetch,
    key: { selector: 'id', type: 'uuid' },
    capabilities: { maxTop: 100, ...capabilities },
    searchFields: ['name'],
    onUnsupported: (report) => reports.push(report),
  });
}

describe.skipIf(!LIVE)('the OData binding against the live roles endpoint', () => {
  beforeAll(async () => {
    token = await getToken();
    expect(token.length).toBeGreaterThan(0);
  });

  beforeEach(() => {
    emitted.length = 0;
    reports.length = 0;
  });

  it('loads a window with a count', async () => {
    const result = await source().load({ skip: 0, take: 2, requireTotalCount: true });

    expect(result.rows).toHaveLength(2);
    expect(result.totalCount).toBe(4);
    expect(result.hasMore).toBe(true);
  });

  it('sorts, including descending', async () => {
    const ascending = await source().load({ sort: [{ field: 'name' }] });
    const descending = await source().load({ sort: [{ field: 'name', desc: true }] });

    const names = ascending.rows.map((role) => role.name);
    expect(names).toEqual([...names].sort());
    expect(descending.rows.map((role) => role.name)).toEqual([...names].reverse());
  });

  it('filters with a tree the server accepts', async () => {
    const result = await source().load({
      filter: {
        op: 'and',
        nodes: [
          { field: 'isSystem', op: 'eq', value: true },
          { field: 'numberOfUsers', op: 'ge', value: 1 },
        ],
      },
      requireTotalCount: true,
    });

    expect(result.rows.every((role) => role.isSystem)).toBe(true);
    expect(result.rows.every((role) => role.numberOfUsers >= 1)).toBe(true);
  });

  it('escapes a literal instead of breaking the expression', async () => {
    const result = await source().load({ filter: { field: 'name', op: 'contains', value: "O'x" } });

    expect(emitted[0]).toContain("'O''x'");
    expect(result.rows).toHaveLength(0);
  });

  it('matches nothing for an impossible membership test, rather than everything', async () => {
    const result = await source().load({ filter: { field: 'id', op: 'in', value: [] } });

    expect(emitted[0]).toBe('?$filter=false&$top=100&$skip=0');
    expect(result.rows).toHaveLength(0);
  });

  it('projects with $select', async () => {
    await source().load({ select: ['id', 'name'] });

    expect(emitted[0]).toContain('$select=id,name');
  });

  it('resolves byKeys with an unquoted GUID', async () => {
    const all = await source().load({});
    const wanted = all.rows.slice(0, 2).map((role) => role.id);

    const found = await source().byKeys?.(wanted);

    expect(emitted[emitted.length - 1]).not.toContain("'");
    expect(found?.map((role) => role.id)).toEqual(wanted);
  });

  it('pages a window past the server cap and returns the whole window', async () => {
    // MaxTop is 100 and there are 4 rows, so declaring a cap of 2 is what makes the endpoint
    // page: three requests, and every row back.
    const result = await odataSource<RoleODataResponse>({
      fetch: liveFetch,
      key: { selector: 'id', type: 'uuid' },
      capabilities: { maxTop: 2 },
    }).load({ skip: 0, take: 100, requireTotalCount: true });

    expect(result.rows).toHaveLength(4);
    expect(emitted.length).toBeGreaterThan(1);
    expect(emitted.every((query) => query.includes('$top=2'))).toBe(true);
  });

  it('is refused for a $top past MaxTop only when the cap is declared too high', async () => {
    // The declared cap is what protects the query. Claiming 1000 gets the 400 the server owes.
    await expect(
      odataSource<RoleODataResponse>({
        fetch: liveFetch,
        key: 'id',
        capabilities: { maxTop: 1000 },
      }).load({ take: 1000 }),
    ).rejects.toMatchObject({ httpError: { httpCode: 400 } });
  });

  it('searches by folding the needle, which needs a normalized column to match', async () => {
    // `name` is not normalized, so a folded needle finds nothing where case differs. This is
    // the measurement, not a wish: it is why searchFields must name the normalized column.
    const lower = await source().load({ search: 'company' });
    const upper = await source().load({ search: 'COMPANY' });

    expect(lower.rows).toHaveLength(1);
    // Folded to the same needle, so the same single row — case-insensitivity the server's own
    // `contains` does not have.
    expect(upper.rows).toHaveLength(1);
  });

  it('declares no loadDistinct, because this endpoint has no $apply', () => {
    expect(typeof source().loadDistinct).toBe('undefined');
  });

  it('is refused if $apply is claimed and the endpoint does not have it', async () => {
    const claimed = source({ apply: true });

    await expect(claimed.loadDistinct?.({ field: 'name', take: 51 })).rejects.toMatchObject({
      httpError: { httpCode: 400 },
    });
  });

  it('is refused if $search is claimed and the endpoint does not have it', async () => {
    await expect(source({ search: true }).load({ search: 'admin' })).rejects.toMatchObject({
      httpError: { httpCode: 400 },
    });
  });

  it('sends only the base surface with the default capabilities', async () => {
    await source().load({
      skip: 0,
      take: 10,
      requireTotalCount: true,
      sort: [{ field: 'name' }],
      filter: { field: 'isSystem', op: 'eq', value: true },
      search: 'admin',
      select: ['id', 'name'],
    });

    const query = emitted[0];
    for (const advanced of ['$apply', '$search', '$compute', '$skiptoken']) {
      expect(query).not.toContain(advanced);
    }
  });
});
