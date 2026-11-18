import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  ariaLabel: 'Σελιδοποίηση',
  // Substituted by the component, not by Transloco: the placeholders are part
  // of the public `currentPageReportTemplate` contract.
  currentReportTemplate: '{currentPage} από {totalPages}',
  firstPageLabel: 'Πρώτη σελίδα',
  prevPageLabel: 'Προηγούμενη σελίδα',
  nextPageLabel: 'Επόμενη σελίδα',
  lastPageLabel: 'Τελευταία σελίδα',
  pagesLabel: 'Σελίδες',
  pageLabel: 'Σελίδα {{ page }}',
  rowsPerPageLabel: 'Γραμμές ανά σελίδα',
  jumpToPageInputLabel: 'Μετάβαση σε σελίδα',
  jumpToPageDropdownLabel: 'Μετάβαση σε σελίδα',
};

export default el;
