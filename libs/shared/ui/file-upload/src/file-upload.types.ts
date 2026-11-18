export type FileUploadMode = 'simple' | 'dropzone';

export type FileUploadStatus = 'queued' | 'uploading' | 'success' | 'error' | 'canceled';

export type FileUploadRejectionCode = 'type' | 'size' | 'count' | 'duplicate';

export interface FileUploadItem {
  readonly id: string;
  readonly file: File;
  readonly previewUrl?: string;
  readonly status: FileUploadStatus;
  readonly progress: number;
  readonly error?: string;
  readonly errorKey?: string;
  readonly errorParams?: Readonly<Record<string, string | number>>;
  readonly response?: unknown;
}

export interface FileUploadRejection {
  readonly file: File;
  readonly code: FileUploadRejectionCode;
}

export interface FileUploadRequest {
  readonly file: File;
  readonly signal: AbortSignal;
  readonly reportProgress: (progress: number) => void;
}

export type FileUploadHandler = (request: FileUploadRequest) => Promise<unknown>;

export interface FileUploadSuccessEvent {
  readonly item: FileUploadItem;
  readonly response: unknown;
}

export interface FileUploadErrorEvent {
  readonly item: FileUploadItem;
  readonly error: unknown;
}
