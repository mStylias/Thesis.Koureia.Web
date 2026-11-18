/**
 * A fake endpoint for the specs.
 *
 * It records the **query string** each call emitted, not the option object, because the string
 * is what the server parses. `odata-query` serializes the object, so an assertion on the object
 * would pass while the query on the wire was wrong.
 */
import { Observable, of, throwError } from 'rxjs';
import {
  odataQueryString,
  type HttpError,
  type ODataQuery,
  type ODataResult,
  type ODataRow,
  type Result,
} from '@synax/client/core';
import type { ODataSourceFetch } from './options';

/** One recorded call. */
export interface RecordedCall {
  /** The query as it would be appended to the URL, `?$filter=...` and all. */
  readonly url: string;
  readonly query: ODataQuery<unknown>;
}

export interface FakeEndpoint<T> {
  readonly fetch: ODataSourceFetch<T>;
  /** Every call, in order. */
  readonly calls: readonly RecordedCall[];
  /** The query string of the only call, failing loudly when there was not exactly one. */
  url(): string;
  /** How many times it was called. */
  readonly count: () => number;
  /** Unsubscribed without settling — what an aborted request looks like from here. */
  readonly unsubscribed: () => number;
}

export interface FakeEndpointOptions {
  /** Rows to answer with. A function is called with the emitted query string. */
  rows?: readonly ODataRow[] | ((url: string, call: number) => readonly ODataRow[]);
  /** `@odata.count`, when the endpoint reports one. */
  totalCount?: number | null;
  /** `@odata.nextLink`, when the endpoint drives its own paging. */
  nextLink?: string;
  /** Answer with this failure instead of rows. */
  fail?: HttpError;
  /** Never settle, so an abort is the only thing that can end the call. */
  hang?: boolean;
}

/** Builds a fake endpoint and the record of what it was asked. */
export function fakeEndpoint<T>(options: FakeEndpointOptions = {}): FakeEndpoint<T> {
  const calls: RecordedCall[] = [];
  let unsubscribed = 0;

  const fetch: ODataSourceFetch<T> = (query) => {
    const url = odataQueryString(query);
    const call = calls.length;
    calls.push({ url, query: query as ODataQuery<unknown> });

    if (options.fail !== undefined) {
      return of<Result<ODataResult<ODataRow>, HttpError>>({
        isSuccess: false,
        error: options.fail,
      } as Result<ODataResult<ODataRow>, HttpError>);
    }

    if (options.hang === true) {
      return new Observable<Result<ODataResult<ODataRow>, HttpError>>(() => () => {
        unsubscribed += 1;
      });
    }

    const rows =
      typeof options.rows === 'function' ? options.rows(url, call) : (options.rows ?? []);

    const data: ODataResult<ODataRow> = {
      items: [...rows],
      totalCount: options.totalCount ?? null,
      ...(options.nextLink === undefined ? {} : { nextLink: options.nextLink }),
    };
    return of<Result<ODataResult<ODataRow>, HttpError>>({
      isSuccess: true,
      data,
    } as Result<ODataResult<ODataRow>, HttpError>);
  };

  return {
    fetch,
    calls,
    url: () => {
      if (calls.length !== 1) {
        throw new Error(`expected exactly one call, saw ${calls.length.toString()}`);
      }
      return calls[0].url;
    },
    count: () => calls.length,
    unsubscribed: () => unsubscribed,
  };
}

/** Rows for the roles endpoint, in the shape it actually answers. */
export function roleRow(id: string, name: string, users = 0): ODataRow {
  return { id, name, isSystem: false, numberOfUsers: users };
}

/** A failure in the shape `parseHttpError` produces. */
export function httpFailure(httpCode: number, errorCode: string, description?: string): HttpError {
  return {
    errorCode,
    httpCode,
    validationErrors: [],
    ...(description === undefined ? {} : { description }),
  };
}

/** An Observable that errors, for a hand-written fetch that does not use `toODataResult()`. */
export function erroringFetch<T>(cause: unknown): ODataSourceFetch<T> {
  return () => throwError(() => cause);
}
