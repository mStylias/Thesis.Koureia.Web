/** A barber as the step renders them, with this selection's total already applied. */
export interface BarberRow {
  readonly id: string;
  readonly displayName: string;
  readonly initials: string;
  readonly avatarUrl: string | null;
  /** Shown only when this barber costs or takes something other than the base. */
  readonly totals: string | null;
}
