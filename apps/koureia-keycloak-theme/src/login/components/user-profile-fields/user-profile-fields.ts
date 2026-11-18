import { AsyncPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { InputFieldByTypeComponent } from '@keycloakify/angular/login/components/input-field-by-type';
import type { I18n as KeycloakI18n } from '@keycloakify/angular/login/i18n';
import {
  type FormAction,
  type FormFieldState,
  UserProfileFormService,
} from '@keycloakify/angular/login/services/user-profile-form';
import { LOGIN_I18N } from '@keycloakify/angular/login/tokens/i18n';
import { KC_LOGIN_CONTEXT } from '@keycloakify/angular/login/tokens/kc-context';
import { InputText } from '@ui/input-text';
import { PasswordInput } from '@ui/password-input';
import type { KcContext } from '../../KcContext';
import { createPasswordRules } from '../../password-rules';
import {
  groupProfileFields,
  isHiddenField,
  maxLengthOf,
  type ProfileFieldGroups,
} from './user-profile-fields.logic';

@Component({
  selector: 'kc-user-profile-fields',
  imports: [AsyncPipe, InputFieldByTypeComponent, InputText, NgTemplateOutlet, PasswordInput],
  templateUrl: './user-profile-fields.html',
  styleUrl: './user-profile-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileFields {
  private readonly form = inject(UserProfileFormService);
  private readonly kcContext =
    inject<Extract<KcContext, { pageId: 'register.ftl' }>>(KC_LOGIN_CONTEXT);

  protected readonly i18n = inject<KeycloakI18n>(LOGIN_I18N);
  readonly showErrors = input(false);
  protected readonly state$ = this.form.formState$;
  protected readonly passwordRules = createPasswordRules(this.kcContext.passwordPolicies);

  protected fieldGroups(fields: readonly FormFieldState[]): ProfileFieldGroups<FormFieldState> {
    return groupProfileFields(fields, (field) => this.isHidden(field));
  }

  protected isHidden(field: FormFieldState): boolean {
    return isHiddenField(field.attribute);
  }

  protected isPassword(field: FormFieldState): boolean {
    return (
      field.attribute.name === 'password' || field.attribute.annotations.inputType === 'password'
    );
  }

  protected isSimpleInput(field: FormFieldState): boolean {
    if (Array.isArray(field.valueOrValues)) {
      return false;
    }

    const inputType = field.attribute.annotations.inputType;
    return inputType === undefined || ['text', 'email', 'tel', 'url'].includes(inputType);
  }

  protected maxLength(field: FormFieldState): number | null {
    return maxLengthOf(field.attribute);
  }

  protected inputType(field: FormFieldState): string {
    return field.attribute.annotations.inputType ?? 'text';
  }

  protected value(field: FormFieldState): string {
    return Array.isArray(field.valueOrValues)
      ? (field.valueOrValues.at(0) ?? '')
      : field.valueOrValues;
  }

  protected update(field: FormFieldState, value: string): void {
    this.form.dispatchFormAction({
      action: 'update',
      name: field.attribute.name,
      valueOrValues: value,
    });
  }

  protected updateFromInput(field: FormFieldState, event: Event): void {
    this.update(field, (event.target as HTMLInputElement).value);
  }

  protected blur(field: FormFieldState): void {
    // Keycloak stores what the form posts, so "  Bob  " is kept verbatim and then greets the
    // person padded in every email. Trim on leaving the field, before validation runs on it.
    const value = this.value(field);
    if (value !== value.trim()) this.update(field, value.trim());

    this.form.dispatchFormAction({
      action: 'focus lost',
      name: field.attribute.name,
      fieldIndex: undefined,
    });
  }

  protected dispatch(action: FormAction): void {
    this.form.dispatchFormAction(action);
  }

  protected errorId(field: FormFieldState): string {
    return `field-error-${field.attribute.name}`;
  }
}
