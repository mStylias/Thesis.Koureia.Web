export { UI_COPY, UiCopyPipe, injectUiCopy, provideUiCopy } from './ui-copy';

export type { UiCopyOverrides, UiCopyResolver } from './ui-copy.types';

export {
  CUSTOMER_UI_COPY_BRANCH,
  customerUiCopy,
  provideCustomerUiCopy,
  uiCopyOverrides,
} from './customer/customer-ui-copy';
export { customerUiCopyEl } from './customer/customer-ui-copy.el';
export { customerUiCopyEn } from './customer/customer-ui-copy.en';
export type {
  CustomerUiCopy,
  UiCopyDictionary,
  UiCopyShape,
} from './customer/customer-ui-copy.types';
