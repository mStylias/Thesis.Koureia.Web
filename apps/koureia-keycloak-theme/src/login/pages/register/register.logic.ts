export function canSubmitRegistration(profileValid: boolean, termsAccepted: boolean): boolean {
  return profileValid && termsAccepted;
}
