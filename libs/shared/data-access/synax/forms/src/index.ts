/*
 * Public API of @synax/forms: the one place that knows both the Synax error contract and what a
 * form editor can place. It keeps @util/forms free of the wire and @ui/* free of HTTP.
 */

export { formErrors, injectFormErrors } from './form-errors';

export type { FieldByCode, FormErrorMapper } from './form-errors.types';
