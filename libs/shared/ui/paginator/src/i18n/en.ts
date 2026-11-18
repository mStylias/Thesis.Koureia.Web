import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  ariaLabel: 'Pagination',
  // Substituted by the component, not by Transloco: the placeholders are part
  // of the public `currentPageReportTemplate` contract.
  currentReportTemplate: '{currentPage} of {totalPages}',
  firstPageLabel: 'First page',
  prevPageLabel: 'Previous page',
  nextPageLabel: 'Next page',
  lastPageLabel: 'Last page',
  pagesLabel: 'Pages',
  pageLabel: 'Page {{ page }}',
  rowsPerPageLabel: 'Rows per page',
  jumpToPageInputLabel: 'Jump to page',
  jumpToPageDropdownLabel: 'Jump to page',
};

export default en;
