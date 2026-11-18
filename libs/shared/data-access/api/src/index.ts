/*
 * Public API of @api/core: where a call goes, what the interceptor does to it, and what a
 * failure looks like on the way back. Wire shapes and per-resource services are elsewhere.
 */

export * from './api-error';
export * from './api-url';
export * from './api.interceptor';
export * from './provide-api';
export * from './transferable';
