import { Result } from '@synax/client/core';
import { Subject, of, type Observable } from 'rxjs';

import type { ListPage } from './account.types';
import { PagedListLoader } from './paged-list';

function page(
  items: readonly string[],
  number: number,
  hasMore: boolean,
): Result<ListPage<string>> {
  return Result.Ok({ items, page: number, hasMore });
}

describe('PagedListLoader', () => {
  it('loads the first page and appends the next one', async () => {
    const pages = [page(['a', 'b'], 1, true), page(['c'], 2, false)];
    const loader = new PagedListLoader<string>((number) => of(pages[number - 1]));

    await loader.reload();
    await loader.more();

    expect(loader.list()).toMatchObject({
      status: 'ready',
      items: ['a', 'b', 'c'],
      page: 2,
      hasMore: false,
    });
  });

  it('keeps the loaded items when "Show more" fails', async () => {
    const loader = new PagedListLoader<string>((number) =>
      of(
        number === 1
          ? page(['a'], 1, true)
          : Result.Fail({ errorCode: 'X', httpCode: 500, validationErrors: [] }),
      ),
    );

    await loader.reload();
    await loader.more();

    expect(loader.list()).toMatchObject({ status: 'ready', items: ['a'], moreFailed: true });
  });

  it('marks the list failed when the first page fails', async () => {
    const loader = new PagedListLoader<string>(() =>
      of(Result.Fail({ errorCode: 'X', httpCode: 500, validationErrors: [] })),
    );

    await loader.reload();

    expect(loader.list().status).toBe('failed');
  });

  it('drops a slow first page that a newer reload overtook', async () => {
    const slow = new Subject<Result<ListPage<string>>>();
    const responses: Observable<Result<ListPage<string>>>[] = [slow, of(page(['fresh'], 1, false))];
    const loader = new PagedListLoader<string>(() => responses.shift() ?? of(page([], 1, false)));

    const first = loader.reload();
    await loader.reload();
    slow.next(page(['stale'], 1, false));
    slow.complete();
    await first;

    expect(loader.list().items).toEqual(['fresh']);
  });

  it('replaces and removes items in place', async () => {
    const loader = new PagedListLoader<string>(() => of(page(['a', 'b'], 1, false)));
    await loader.reload();

    loader.replace((item) => item === 'a', 'A');
    loader.remove((item) => item === 'b');

    expect(loader.list().items).toEqual(['A']);
  });
});
