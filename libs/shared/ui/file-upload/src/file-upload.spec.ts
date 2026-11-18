import { ComponentFixture, TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { provideUiCopy } from '@util/ui-copy';
import { FileUpload } from './file-upload';
import type { FileUploadHandler } from './file-upload.types';

class MockEventTarget {
  private readonly listeners = new Map<string, EventListenerOrEventListenerObject>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners.set(type, listener);
  }

  emit(type: string, event: Event): void {
    const listener = this.listeners.get(type);
    if (typeof listener === 'function') {
      listener(event);
    } else {
      listener?.handleEvent(event);
    }
  }
}

class MockXmlHttpRequest extends MockEventTarget {
  static latest: MockXmlHttpRequest | undefined;

  readonly upload = new MockEventTarget();
  status = 201;
  responseText = '{"id":"server-file"}';
  withCredentials = false;
  method = '';
  url = '';
  body: Document | XMLHttpRequestBodyInit | null = null;
  readonly requestHeaders = new Map<string, string>();

  constructor() {
    super();
    MockXmlHttpRequest.latest = this;
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders.set(name, value);
  }

  getResponseHeader(name: string): string | null {
    return name.toLowerCase() === 'content-type' ? 'application/json' : null;
  }

  send(body: Document | XMLHttpRequestBodyInit | null): void {
    this.body = body;
    this.upload.emit(
      'progress',
      new ProgressEvent('progress', { lengthComputable: true, loaded: 1, total: 2 }),
    );
    this.emit('load', new Event('load'));
  }

  abort(): void {
    this.emit('abort', new Event('abort'));
  }
}

describe('FileUpload', () => {
  let fixture: ComponentFixture<FileUpload>;
  let component: FileUpload;

  const file = (name: string, type = 'text/plain', contents = 'content'): File =>
    new File([contents], name, { type, lastModified: 1 });

  // The lazy scope loads through a dynamic import, so anything asserting
  // rendered copy has to wait for it — and for the render that follows.
  async function loadScope(): Promise<void> {
    await fixture.whenStable();
    await firstValueFrom(TestBed.inject(TranslocoService).load('fileUpload/en'));
    await fixture.whenStable();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['el', 'en'],
            defaultLang: 'en',
            fallbackLang: 'en',
            missingHandler: { useFallbackTranslation: true },
          },
        }),
      ],
    });
    fixture = TestBed.createComponent(FileUpload);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the accessible chooser in dropzone mode by default', async () => {
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const input = root.querySelector<HTMLInputElement>('input[type="file"]');
    const button = root.querySelector<HTMLButtonElement>('.file-upload-dropzone button');

    expect(input).toBeTruthy();
    expect(input?.getAttribute('aria-hidden')).toBe('true');
    expect(button).toBeTruthy();
    expect(root.querySelector('.file-upload-simple')).toBeNull();
  });

  it('renders only the chooser container in simple mode', async () => {
    fixture.componentRef.setInput('mode', 'simple');
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.file-upload-simple button')).toBeTruthy();
    expect(root.querySelector('.file-upload-dropzone')).toBeNull();
    expect(root.querySelector('.file-upload-queue')).toBeNull();
  });

  it('validates type, size, count, and duplicate files before queuing', async () => {
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('accept', 'image/*,.pdf');
    fixture.componentRef.setInput('maxFileSize', 5);
    fixture.componentRef.setInput('maxFiles', 1);
    await fixture.whenStable();

    const accepted = file('photo.png', 'image/png', '1234');
    component.addFiles([
      accepted,
      file('notes.txt', 'text/plain', 'x'),
      file('large.pdf', 'application/pdf', '123456'),
      file('second.pdf', 'application/pdf', '1234'),
    ]);
    await fixture.whenStable();

    expect(component.value()).toEqual([accepted]);
    expect(component.rejections().map((entry) => entry.code)).toEqual(['type', 'size', 'count']);

    component.remove(component.items()[0]);
    component.addFiles([accepted, accepted]);
    expect(component.rejections().map((entry) => entry.code)).toEqual(['duplicate']);
  });

  it('uses a custom handler with progress and records a successful response', async () => {
    const handler: FileUploadHandler = ({ file: selected, reportProgress }) => {
      reportProgress(42);
      expect(selected.name).toBe('document.pdf');
      return Promise.resolve({ id: 'uploaded-file' });
    };
    fixture.componentRef.setInput('uploadHandler', handler);
    await fixture.whenStable();

    component.addFiles([file('document.pdf', 'application/pdf')]);
    await component.upload();
    await fixture.whenStable();

    expect(component.items()[0]).toMatchObject({
      status: 'success',
      progress: 100,
      response: { id: 'uploaded-file' },
    });
  });

  it('posts each file to uploadUrl as multipart form data', async () => {
    vi.stubGlobal('XMLHttpRequest', MockXmlHttpRequest);
    fixture.componentRef.setInput('uploadUrl', '/api/files');
    fixture.componentRef.setInput('fieldName', 'attachment');
    fixture.componentRef.setInput('headers', { 'X-Test': 'yes' });
    fixture.componentRef.setInput('formData', { folder: 'documents' });
    fixture.componentRef.setInput('withCredentials', true);
    await fixture.whenStable();

    const document = file('document.pdf', 'application/pdf');
    component.addFiles([document]);
    await component.upload();

    const request = MockXmlHttpRequest.latest;
    expect(request).toMatchObject({
      method: 'POST',
      url: '/api/files',
      withCredentials: true,
    });
    expect(request?.requestHeaders.get('X-Test')).toBe('yes');
    const body = request?.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('attachment') as File).name).toBe(document.name);
    expect(body.get('folder')).toBe('documents');
    expect(component.items()[0]).toMatchObject({
      status: 'success',
      progress: 100,
      response: { id: 'server-file' },
    });
  });

  it('keeps failed files for a successful retry', async () => {
    let attempts = 0;
    const handler: FileUploadHandler = () => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('Temporary failure'))
        : Promise.resolve('ok');
    };
    fixture.componentRef.setInput('uploadHandler', handler);
    await fixture.whenStable();

    component.addFiles([file('retry.txt')]);
    await component.upload();
    expect(component.items()[0]).toMatchObject({
      status: 'error',
      error: 'Temporary failure',
    });

    await component.retry(component.items()[0]);
    expect(component.items()[0]).toMatchObject({
      status: 'success',
      response: 'ok',
    });
  });

  it('aborts an active custom upload and exposes a retryable canceled state', async () => {
    const handler: FileUploadHandler = ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    fixture.componentRef.setInput('uploadHandler', handler);
    await fixture.whenStable();

    component.addFiles([file('large.mov', 'video/quicktime')]);
    const uploading = component.upload();
    component.cancel(component.items()[0]);
    await uploading;

    expect(component.items()[0].status).toBe('canceled');
  });

  it('does not let a canceled attempt clobber the retry that replaced it', async () => {
    const attempts: { signal: AbortSignal; reject: (reason: unknown) => void }[] = [];
    // A transport that takes a moment to unwind after abort, so the
    // canceled attempt is still settling when the retry starts.
    const handler: FileUploadHandler = ({ signal }) =>
      new Promise((_resolve, reject) => {
        attempts.push({ signal, reject });
      });
    fixture.componentRef.setInput('uploadHandler', handler);
    await fixture.whenStable();

    component.addFiles([file('large.mov', 'video/quicktime')]);
    const first = component.upload();
    const item = component.items()[0];

    component.cancel(item);
    const second = component.retry(item);
    expect(attempts.length).toBe(2);

    attempts[0].reject(new Error('aborted'));
    await first;

    // The late cancellation must not roll the live retry back.
    expect(component.items()[0].status).toBe('uploading');

    // ...nor drop the retry's controller, which `cancel` still needs.
    component.cancel(item);
    expect(attempts[1].signal.aborted).toBe(true);

    attempts[1].reject(new Error('aborted'));
    await second;
    expect(component.items()[0].status).toBe('canceled');
  });

  // Regression: `numberAttribute` passes negatives and fractions straight
  // through, and a negative maxFiles left zero available slots — every
  // file was rejected with a "too many files" message.
  it('treats a negative or fractional limit as unlimited or floored', async () => {
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('maxFiles', -1);
    fixture.componentRef.setInput('maxFileSize', -100);
    await fixture.whenStable();

    component.addFiles([file('first.txt'), file('second.txt')]);
    expect(component.rejections()).toEqual([]);
    expect(component.value()).toHaveLength(2);

    component.clear();
    fixture.componentRef.setInput('maxFiles', 1.8);
    await fixture.whenStable();

    component.addFiles([file('third.txt'), file('fourth.txt')]);
    expect(component.value()).toHaveLength(1);
    expect(component.rejections().map((entry) => entry.code)).toEqual(['count']);
  });

  // Regression: an unknown throw wrote a hardcoded English sentence into
  // `error`, which the template prefers over the translated fallback key.
  it('falls back to a translated key rather than English for an unknown throw', async () => {
    // Not an Error at all — cast so the reject-with-Error lint rule, which
    // only inspects types, does not object to the very thing under test.
    const notAnError = 'boom' as unknown as Error;
    fixture.componentRef.setInput('uploadHandler', () => Promise.reject(notAnError));
    await fixture.whenStable();

    component.addFiles([file('mystery.txt')]);
    await component.upload();

    expect(component.items()[0]).toMatchObject({
      status: 'error',
      error: undefined,
      errorKey: 'fileUpload.errors.unknown',
    });
  });

  it('falls back to a translated key when an Error carries no message', async () => {
    fixture.componentRef.setInput('uploadHandler', () => Promise.reject(new Error('')));
    await fixture.whenStable();

    component.addFiles([file('silent.txt')]);
    await component.upload();

    expect(component.items()[0]).toMatchObject({
      status: 'error',
      error: undefined,
      errorKey: 'fileUpload.errors.unknown',
    });
  });

  it('marks the chooser invalid and describes it with the messages', async () => {
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const chooser = (): HTMLButtonElement => {
      const button = root.querySelector<HTMLButtonElement>('.file-upload-dropzone button');
      if (!button) {
        throw new Error('chooser button not rendered');
      }
      return button;
    };

    expect(chooser().hasAttribute('aria-invalid')).toBe(false);
    expect(chooser().hasAttribute('aria-describedby')).toBe(false);

    fixture.componentRef.setInput('ariaDescribedby', 'consumer-hint');
    fixture.componentRef.setInput('accept', 'image/*');
    await fixture.whenStable();
    expect(chooser().getAttribute('aria-describedby')).toBe('consumer-hint');

    component.addFiles([file('notes.txt')]);
    await fixture.whenStable();

    expect(chooser().getAttribute('aria-invalid')).toBe('true');
    // The consumer's id is kept and the control's own appended, not swapped.
    expect(chooser().getAttribute('aria-describedby')).toMatch(
      /^consumer-hint lib-file-upload-\d+-errors$/,
    );
    const errorsId = chooser().getAttribute('aria-describedby')?.split(' ')[1] ?? '';
    expect(root.querySelector(`[id="${errorsId}"]`)?.matches('lib-banner[role="alert"]')).toBe(
      true,
    );
  });

  it('shows a schema error only once the field is touched', async () => {
    await loadScope();
    fixture.componentRef.setInput('errors', [{ kind: 'required' }]);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('lib-banner[role="alert"]')).toBeNull();

    fixture.componentRef.setInput('touched', true);
    await fixture.whenStable();

    expect(root.querySelector('lib-banner[role="alert"]')?.textContent).toContain(
      'Add at least one file',
    );
  });

  // Regression: Signal Forms drives `invalid` straight off the schema, so a
  // required field painted the control red the moment the story loaded.
  it('does not paint a schema-invalid control before any interaction', async () => {
    fixture.componentRef.setInput('errors', [{ kind: 'required' }]);
    fixture.componentRef.setInput('invalid', true);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.hasAttribute('data-invalid')).toBe(false);

    fixture.componentRef.setInput('touched', true);
    await fixture.whenStable();

    expect(host.hasAttribute('data-invalid')).toBe(true);
  });

  it('still paints a bare invalid input at once', async () => {
    fixture.componentRef.setInput('invalid', true);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).hasAttribute('data-invalid')).toBe(true);
  });

  // Regression: the OS picker pulls focus off the document, so the focusout
  // it fires marked the field blurred and painted the error while the
  // dialog was still open.
  it('does not treat opening the native picker as a blur', async () => {
    let touches = 0;
    fixture.componentRef.setInput('errors', [{ kind: 'required' }]);
    const subscription = fixture.componentInstance.touch.subscribe(() => {
      touches += 1;
    });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.choose();
    host.dispatchEvent(new FocusEvent('focusout', { bubbles: false }));
    await fixture.whenStable();

    expect(touches).toBe(0);
    expect(host.querySelector('lib-banner[role="alert"]')).toBeNull();

    // Focus coming back means the dialog is closed; a real blur counts again.
    host.dispatchEvent(new FocusEvent('focusin', { bubbles: false }));
    host.dispatchEvent(new FocusEvent('focusout', { bubbles: false }));
    await fixture.whenStable();

    expect(touches).toBe(1);
    expect(host.querySelector('lib-banner[role="alert"]')).not.toBeNull();
    subscription.unsubscribe();
  });

  it('summarises the queue in one live region instead of one per row', async () => {
    await loadScope();
    fixture.componentRef.setInput('multiple', true);
    fixture.componentRef.setInput('uploadHandler', () => Promise.resolve('ok'));
    await fixture.whenStable();

    component.addFiles([file('a.txt'), file('b.txt')]);
    await component.upload();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const live = root.querySelectorAll('[aria-live], [role="status"]');
    expect(live).toHaveLength(1);
    expect(live[0].textContent.trim()).toBe('2 of 2 files uploaded');
  });

  // Regression: animate.enter also runs on the first render, so a
  // pre-filled queue animated itself into view on load. jsdom has no Web
  // Animations API and strips the enter class before it can be read, so
  // the gate itself is what is asserted here.
  it('arms the queue enter animation only after the first paint', async () => {
    const prefilled = TestBed.createComponent(FileUpload);
    const gate = (): boolean =>
      (prefilled.componentInstance as unknown as { mounted: () => boolean }).mounted();

    prefilled.componentRef.setInput('multiple', true);
    prefilled.componentInstance.value.set([file('a.txt'), file('b.txt')]);

    // Closed while the rows the pre-filled value produces are rendered...
    expect(gate()).toBe(false);

    prefilled.detectChanges();
    await prefilled.whenStable();

    expect(
      (prefilled.nativeElement as HTMLElement).querySelectorAll('.file-upload-item'),
    ).toHaveLength(2);
    // ...and open from the first paint on, so later rows do animate.
    expect(gate()).toBe(true);
  });

  it('supports programmatic value writes, removal, and clearing', async () => {
    fixture.componentRef.setInput('multiple', true);
    await fixture.whenStable();
    const first = file('first.txt');
    const second = file('second.txt');

    component.value.set([first, second]);
    await fixture.whenStable();
    expect(component.items().map((item) => item.file)).toEqual([first, second]);

    component.remove(component.items()[0]);
    expect(component.value()).toEqual([second]);

    component.clear();
    expect(component.value()).toEqual([]);
    expect(component.items()).toEqual([]);
  });
});

describe('FileUpload copy', () => {
  it('reads a key the consumer overrides in place of its own', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: { availableLangs: ['el', 'en'], defaultLang: 'en', fallbackLang: 'en' },
        }),
        provideUiCopy({
          'fileUpload.dropHint': 'customer.dropHint',
          'fileUpload.maxFiles': 'customer.maxFiles',
        }),
      ],
    });
    const fixture = TestBed.createComponent(FileUpload);
    const transloco = TestBed.inject(TranslocoService);
    transloco.setTranslation(
      { customer: { dropHint: 'Drop your photos here', maxFiles: 'No more than {{count}}' } },
      'en',
      { merge: true },
    );
    fixture.componentRef.setInput('maxFiles', 3);
    await fixture.whenStable();
    await firstValueFrom(transloco.load('fileUpload/en'));
    await fixture.whenStable();

    const hint = (fixture.nativeElement as HTMLElement).querySelector('.file-upload-hint');
    expect(hint?.textContent).toContain('Drop your photos here');
    expect(hint?.textContent).toContain('No more than 3');
  });
});
