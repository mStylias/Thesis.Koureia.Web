/** One closure or special-hours range as the dialog edits it. Shop-local dates and times. */
export interface ClosureFormValue {
  startsOn: string;
  endsOn: string;
  closedAllDay: boolean;
  openTime: string;
  closeTime: string;
  name: string;
}
