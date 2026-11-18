/** `TranslocoService.translate`, as the pure helpers take it. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Which members the page shows. */
export type StaffFilter = 'active' | 'inactive' | 'all';
