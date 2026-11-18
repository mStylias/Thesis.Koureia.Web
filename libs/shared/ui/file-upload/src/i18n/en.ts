import type { Translation } from '@jsverse/transloco';

const en: Translation = {
  actions: {
    choose: 'Choose files',
    upload: 'Upload files',
    clear: 'Clear',
    retryFile: 'Retry {{name}}',
    cancelFile: 'Cancel upload of {{name}}',
    removeFile: 'Remove {{name}}',
  },
  dropHint: 'Drag and drop files here, or use the button',
  accepted: 'Accepted: {{accept}}',
  maxSize: 'Up to {{size}} per file',
  maxFiles: 'Up to {{count}} files',
  required: 'Required',
  queue: 'Files selected for upload',
  progress: 'Uploading {{name}}',
  live: {
    uploading: 'Uploading files',
    finished: '{{done}} of {{total}} files uploaded',
    finishedWithErrors: '{{done}} of {{total}} files uploaded, {{failed}} failed',
  },
  status: {
    queued: 'Ready to upload',
    uploading: 'Uploading',
    success: 'Upload complete',
    error: 'Upload failed',
    canceled: 'Upload canceled',
  },
  errors: {
    type: '{{name}} is not an accepted file type ({{accept}})',
    size: '{{name}} is larger than the {{size}} limit',
    count: 'Only {{count}} files can be added',
    duplicate: '{{name}} has already been added',
    noUploader: 'No upload URL or custom upload handler was provided',
    http: 'The server rejected the upload (status {{status}})',
    network: 'The upload could not reach the server. Check your connection and try again',
    canceled: 'Upload canceled',
    unknown: 'The file could not be uploaded. Try again',
    required: 'Add at least one file',
    invalid: 'The selected files are not valid',
  },
};

export default en;
