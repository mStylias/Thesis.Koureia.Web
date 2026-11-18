/** One time off as the dialog edits it. Dates `YYYY-MM-DD`, times `HH:mm`, all shop-local. */
export interface TimeOffFormValue {
  startsOn: string;
  endsOn: string;
  wholeDays: boolean;
  startTime: string;
  endTime: string;
  reason: string;
}
