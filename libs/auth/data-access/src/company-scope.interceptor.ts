import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { isApiUrl } from '@api/core';
import { SYNAX_API_CONFIG, injectSynaxUrl, tryAsHttpError } from '@synax/client';

import { StaffAccessStore } from './staff-access.store';
import { WorkspaceCompanyChoice } from './workspace-company-choice';

const COMPANY_HEADER = 'X-Company-Id';
const COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND';

/**
 * Sends the superadmin's picked shop as `X-Company-Id` on calls to the configured API.
 *
 * The API reads the header only from a superadmin, so this does not check the role.
 *
 * A picked shop can be deleted. Every company call then answers `404 COMPANY_NOT_FOUND`. A public
 * slug route answers the same code for an unknown slug, so a company call only triggers a
 * workspace read. The workspace call is the one that decides: its only source of that code is the
 * header, so it clears the pick and asks again without it.
 */
export const companyScopeInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(SYNAX_API_CONFIG, { optional: true })?.baseUrl;
  if (!isApiUrl(req.url, baseUrl)) return next(req);

  const choice = inject(WorkspaceCompanyChoice);
  const companyId = choice.companyId();
  if (companyId === null || req.headers.has(COMPANY_HEADER)) return next(req);

  // Read now: the error handler runs outside the injection context.
  const injector = inject(Injector);
  const isWorkspaceRead = req.url === injectSynaxUrl()('users/me/workspace');

  return next(req.clone({ setHeaders: { [COMPANY_HEADER]: companyId } })).pipe(
    catchError((error: unknown) => {
      if (tryAsHttpError(error)?.errorCode !== COMPANY_NOT_FOUND) return throwError(() => error);

      if (isWorkspaceRead) {
        if (choice.companyId() === companyId) choice.clear();
        return next(req);
      }

      void injector.get(StaffAccessStore).reload();
      return throwError(() => error);
    }),
  );
};
