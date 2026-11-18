export type DateBucketLevel = 'year' | 'month' | 'day';

/** One selectable period in a date header-filter tree. */
export interface DateBucket {
  key: string;
  label: string;
  level: DateBucketLevel;
  start: Date;
  end: Date;
  /** Null for a generated calendar whose source did not return counts. */
  count: number | null;
  children: readonly DateBucket[];
}

export interface DateBucketOptions {
  locale?: string;
  /** Builds every day in the inclusive range rather than only returned days. */
  generatedRange?: { min: unknown; max: unknown };
}
