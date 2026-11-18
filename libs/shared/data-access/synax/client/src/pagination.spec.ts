import { of, Subject } from 'rxjs';
import { HttpError, KeysetPage, PagedResult, Result } from '@synax/client/core';
import { KeysetPaginator, PagedSource } from './index';

const notFound: HttpError = { errorCode: 'NOT_FOUND', httpCode: 404, validationErrors: [] };

function keysetPage(
  items: string[],
  nextCursor: string | null,
  hasMore: boolean,
): KeysetPage<string, string> {
  return { items, pageSize: items.length, hasMore, nextCursor };
}

describe('KeysetPaginator', () => {
  it('accumulates pages and feeds nextCursor back as after', () => {
    const seenCursors: (string | null)[] = [];
    const pages: Record<string, KeysetPage<string, string>> = {
      initial: keysetPage(['a', 'b'], 'b', true),
      b: keysetPage(['c'], 'c', false),
    };
    const paginator = new KeysetPaginator<string, string>((after) => {
      seenCursors.push(after);
      return of(Result.Ok(pages[after ?? 'initial']));
    });

    paginator.loadMore();
    expect(paginator.items()).toEqual(['a', 'b']);
    expect(paginator.hasMore()).toBe(true);

    paginator.loadMore();
    expect(paginator.items()).toEqual(['a', 'b', 'c']);
    expect(paginator.hasMore()).toBe(false);
    expect(seenCursors).toEqual([null, 'b']);
  });

  it('does not fetch past the end or while loading', () => {
    let calls = 0;
    const gate = new Subject<Result<KeysetPage<string, string>, HttpError>>();
    const paginator = new KeysetPaginator<string, string>(() => {
      calls++;
      return gate.asObservable();
    });

    paginator.loadMore();
    paginator.loadMore(); // ignored — still loading
    expect(calls).toBe(1);
    expect(paginator.loading()).toBe(true);

    gate.next(Result.Ok(keysetPage(['a'], null, false)));
    expect(paginator.loading()).toBe(false);

    paginator.loadMore(); // ignored — hasMore is false
    expect(calls).toBe(1);
  });

  it('surfaces failures and allows retrying', () => {
    let fail = true;
    const paginator = new KeysetPaginator<string, string>(() =>
      of(fail ? Result.Fail(notFound) : Result.Ok(keysetPage(['a'], null, false))),
    );

    paginator.loadMore();
    expect(paginator.error()).toEqual(notFound);
    expect(paginator.items()).toEqual([]);

    fail = false;
    paginator.loadMore(); // hasMore still true — the failed load did not consume it
    expect(paginator.error()).toBeNull();
    expect(paginator.items()).toEqual(['a']);
  });

  it('reset clears state and restarts from the beginning', () => {
    const seenCursors: (string | null)[] = [];
    const paginator = new KeysetPaginator<string, string>((after) => {
      seenCursors.push(after);
      return of(Result.Ok(keysetPage(['a'], 'a', true)));
    });

    paginator.loadMore();
    paginator.reset();
    expect(paginator.items()).toEqual([]);
    expect(paginator.hasMore()).toBe(true);

    paginator.loadMore();
    expect(seenCursors).toEqual([null, null]);
  });
});

function pagedResult(
  items: string[],
  page: number,
  totalCount: number,
  pageSize = 2,
): PagedResult<string> {
  const totalPages = Math.ceil(totalCount / pageSize);
  return {
    items,
    page,
    pageSize,
    totalCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

describe('PagedSource', () => {
  it('loads the current page and exposes PagedResult metadata', () => {
    const source = new PagedSource<string>(
      (page, pageSize) => of(Result.Ok(pagedResult(['a', 'b'], page, 5, pageSize))),
      { pageSize: 2 },
    );

    source.load();

    expect(source.items()).toEqual(['a', 'b']);
    expect(source.totalCount()).toBe(5);
    expect(source.totalPages()).toBe(3);
    expect(source.hasNextPage()).toBe(true);
    expect(source.hasPreviousPage()).toBe(false);
  });

  it('navigates with nextPage/previousPage, guarded by the metadata', () => {
    const requestedPages: number[] = [];
    const source = new PagedSource<string>(
      (page, pageSize) => {
        requestedPages.push(page);
        return of(Result.Ok(pagedResult(['x'], page, 5, pageSize)));
      },
      { pageSize: 2 },
    );

    source.load();
    source.nextPage();
    expect(source.page()).toBe(2);

    source.previousPage();
    expect(source.page()).toBe(1);

    source.previousPage(); // ignored — already at the first page
    expect(requestedPages).toEqual([1, 2, 1]);
  });

  it('setPageSize resets to page 1', () => {
    const source = new PagedSource<string>((page, pageSize) =>
      of(Result.Ok(pagedResult(['x'], page, 50, pageSize))),
    );

    source.load();
    source.goToPage(3);
    source.setPageSize(10);

    expect(source.page()).toBe(1);
    expect(source.pageSize()).toBe(10);
  });

  it('cancels the in-flight load when a new one starts', () => {
    const first = new Subject<Result<PagedResult<string>, HttpError>>();
    const second = new Subject<Result<PagedResult<string>, HttpError>>();
    let call = 0;
    const source = new PagedSource<string>(() => (++call === 1 ? first : second));

    source.load();
    source.goToPage(2);

    first.next(Result.Ok(pagedResult(['stale'], 1, 10))); // ignored — unsubscribed
    second.next(Result.Ok(pagedResult(['fresh'], 2, 10)));

    expect(source.items()).toEqual(['fresh']);
    expect(source.page()).toBe(2);
  });

  it('surfaces failures without clearing the previous page', () => {
    let fail = false;
    const source = new PagedSource<string>((page, pageSize) =>
      of(fail ? Result.Fail(notFound) : Result.Ok(pagedResult(['a'], page, 1, pageSize))),
    );

    source.load();
    fail = true;
    source.refresh();

    expect(source.error()).toEqual(notFound);
    expect(source.items()).toEqual(['a']);
  });
});
