import { i18nBuilder } from '@keycloakify/angular/login';
import type { ThemeName } from '../kc.gen';

/*
 * Two kinds of string live here.
 *
 * The first block of each language is copy this theme invented, for pages Keycloak has no text
 * for. The second block overrides text that Keycloak ships, because its Greek breaks the two
 * rules the product holds every visitor-facing sentence to:
 *
 * 1. Sentence case. One capital, at the start.
 * 2. Second person singular. Keycloak's Greek uses the plural, so a person meets "Ξεχάσατε" on
 *    the login form and "Ξέχασες" one screen later.
 *
 * NOTE: A key absent from this file falls through to Keycloak's own translation. Read the
 * shipped value before you add one: `docker cp` the themes JAR out of the container and open
 * `theme/base/login/messages/messages_el.properties`.
 */
const { getI18n, ofTypeI18n } = i18nBuilder
  .withThemeName<ThemeName>()
  .withCustomTranslations({
    en: {
      authHeroEyebrow: 'Appointments, without the phone calls',
      authHeroTitle: 'Your next haircut starts here.',
      authHeroDescription: 'Find the right professional and book a time that works for you.',
      loginDescription: 'Sign in to manage your appointments.',
      registerDescription: 'Create your account to book your first appointment.',
      termsPrefix: 'I agree to the',
      termsLink: 'Terms of Service',
      termsSuffix: '.',
      termsRequired: 'You must accept the Terms of Service to create an account.',
      socialLoginDivider: 'Or',
      googleSignInLabel: 'Sign in with Google',
      registrationPrompt: 'New to Koureia?',
      loginPrompt: 'Already have an account?',
      backToLoginLabel: 'Back to login',
      // Keycloak's base copy describes an administrator's forced password change. This page is
      // usually somebody who clicked a link in their mail.
      updatePasswordDescription: 'Choose a new password for your account.',
      passwordNewLabel: 'New password',
      updatePasswordSubmit: 'Save password',
      passwordRequirementsError: 'Use a password that meets every requirement.',
      // Reached by `UPDATE_PROFILE`, and by `VERIFY_PROFILE` when a stored profile stops
      // satisfying the realm. Keycloak's base title is Title Case.
      loginProfileTitle: 'Update your account details',
      updateProfileDescription: 'Complete your details to continue.',
      updateProfileSubmit: 'Save and continue',
      // Keycloak's base title is "Terms and Conditions", which is not what the document is called.
      termsTitle: 'Terms of Service',
      termsDescription: 'Read and accept the Terms of Service to continue.',
      termsReadLink: 'Read the Terms of Service',
      doAccept: 'Accept',
      doDecline: 'Decline',
      emailVerifyTitle: 'Verify your email address',
      emailVerifyInstruction1: 'We sent a verification link to {0}. Open it to continue.',
      // A restarted session drops the user, and then there is no address to name.
      emailVerifyNoAddress: 'We sent you a verification link. Open it to continue.',
      emailVerifyNotReceived: 'Did not get the email?',
      emailVerifyResend: 'Send it again',
      // Google sign-in onto an address that already has a password account. Keycloak's base title
      // is "Account already exists", which reads as a refusal rather than an offer.
      confirmLinkIdpTitle: 'You already have an account',
      idpLinkConfirmDescription:
        'An account with this email address already exists. You may link your accounts to log in using either method. Your account data will remain intact.',
      // The banner above the form. Keycloak sends the field name as {0} and its value as {1}, and
      // its own sentence asks a question the page already answers with two controls. {0} is
      // dropped because the value it labels is plainly an address.
      federatedIdentityConfirmLinkMessage: 'The address "{1}" already exists',
      idpLinkConfirmSubmit: 'Link accounts',
      idpLinkConfirmCancel: 'Sign in another way',
      // Keycloak's base title is "Link {0}", which names the provider and not the task.
      emailLinkIdpTitle: 'Confirm it is you',
      idpLinkEmailDescription: 'We sent a link to {0}. Open it to link {1} to your account.',
      idpLinkEmailConfirmedElsewhere: 'I opened it on another device',
      // Keycloak's base title is "Update Account Information", the same words as the required
      // action. Here nothing is being updated — the account does not exist yet.
      loginIdpReviewProfileTitle: 'Complete your details',
      // Keycloak's base title is "We are sorry...", which says nothing about what happened.
      errorTitle: 'Something went wrong',
      pageExpiredTitle: 'This page expired',
      pageExpiredDescription:
        'You were away long enough for the sign-in to time out. Start again, or pick up where you left off.',
      pageExpiredRestart: 'Start again',
      pageExpiredContinue: 'Continue where I left off',
      // The outcome page, for a flow with no client to return to.
      goToHome: 'Go to the home page',
      // Keycloak names the outcome with a message key and ships no text for this one, so
      // without an entry the page prints `accountUpdatedTitle`. Keep the wording general:
      // Keycloak reuses this heading after any required action, so "Password changed" would
      // one day greet somebody who changed an email address.
      accountUpdatedTitle: 'Account updated',
      infoSuccessTitle: 'All done',
      infoNoticeTitle: 'One more thing',
      infoRedirectCountdown: 'Taking you to the home page in {0} seconds.',
      infoRedirectCountdownOne: 'Taking you to the home page in 1 second.',
      // The off switch WCAG 2.2.1 requires for the countdown above.
      infoStayOnPage: 'Stay on this page',

      // Titles and labels.
      loginAccountTitle: 'Sign in to your account',
      doForgotPassword: 'Forgot password?',
      emailForgotTitle: 'Forgot your password?',
      doSubmit: 'Submit',
      emailInstruction:
        'Enter your username or email address and we will send you instructions to set a new password.',
      emailInstructionUsername:
        'Enter your username and we will send you instructions to set a new password.',
      backToApplication: '« Back to the application',
      backToLogin: '« Back to sign-in',
      proceedWithAction: '» Click here to continue',

      // Outcomes, read by `info.ftl`.
      // Stays vague about whether the account exists. Keycloak shows this page either way.
      emailSentMessage:
        'You will receive an email with instructions shortly, provided an account is registered with this email address.',
      emailVerifiedMessage: 'Your email address is verified.',
      accountUpdatedMessage: 'Your account is updated.',

      // Errors.
      expiredActionMessage: 'The action expired. Sign in again to continue.',
      expiredActionTokenSessionExistsMessage: 'The action expired. Start again.',
      expiredCodeMessage: 'The sign-in timed out. Sign in again.',
      missingUsernameMessage: 'Enter your username.',
      missingPasswordMessage: 'Enter your password.',
      missingFirstNameMessage: 'Enter your first name.',
      missingLastNameMessage: 'Enter your last name.',
      missingEmailMessage: 'Enter your email address.',
      // Every empty required field on the register and update-profile forms. The base asks the
      // person to "specify" a field, which names neither the field nor what is wrong with it.
      'error-user-attribute-required': 'This field is required',
      termsAcceptanceRequired: 'You must accept the Terms of Service to create an account.',
      accountDisabledMessage: 'This account is disabled. Contact your administrator.',
      cookieNotFoundMessage:
        'The sign-in cookie was not found. Make sure that cookies are enabled and try again.',
      emailSendErrorMessage: 'Sending the email failed. Try again later.',
      // The base says "Access denied when authenticating with {0}", which reads as a refusal by
      // the provider. The person pressed cancel on Google's consent screen.
      'access-denied-when-idp-auth': '{0} sign in was cancelled',
      // The base says "Email already exists.", which does not say what to do about it.
      emailExistsMessage: 'An account with this email address already exists. Sign in instead.',

      // Pending actions. The English base title-cases these.
      'requiredAction.UPDATE_PASSWORD': 'Update password',
      'requiredAction.UPDATE_PROFILE': 'Update profile',
      'requiredAction.VERIFY_EMAIL': 'Verify email',
      'requiredAction.UPDATE_EMAIL': 'Update email',
      'requiredAction.VERIFY_PROFILE': 'Verify profile',
      'requiredAction.CONFIGURE_RECOVERY_AUTHN_CODES': 'Generate recovery codes',
      'requiredAction.TERMS_AND_CONDITIONS': 'Terms of Service',
      'requiredAction.webauthn-register-passwordless': 'Register a passwordless key',
      'requiredAction.delete_credential': 'Delete credential',
      'requiredAction.idp_link': 'Link an identity provider',
      'requiredAction.update_user_locale': 'Update language',
    },
    el: {
      authHeroEyebrow: 'Ραντεβού, χωρίς τηλεφωνήματα',
      authHeroTitle: 'Το επόμενο κούρεμά σου ξεκινά εδώ.',
      authHeroDescription: 'Βρες τον κατάλληλο επαγγελματία και κλείσε την ώρα που σε εξυπηρετεί.',
      loginDescription: 'Συνδέσου για να διαχειριστείς τα ραντεβού σου.',
      registerDescription: 'Δημιούργησε λογαριασμό για να κλείσεις το πρώτο σου ραντεβού.',
      termsPrefix: 'Συμφωνώ με τους',
      // Τίτλος εγγράφου, άρα κεφαλαία και μέσα στην πρόταση.
      termsLink: 'Όρους Χρήσης',
      termsSuffix: '.',
      termsRequired: 'Πρέπει να αποδεχτείς τους Όρους Χρήσης για να δημιουργήσεις λογαριασμό.',
      socialLoginDivider: 'Ή',
      googleSignInLabel: 'Σύνδεση με Google',
      registrationPrompt: 'Νέος στο Koureia;',
      loginPrompt: 'Έχεις ήδη λογαριασμό;',
      backToLoginLabel: 'Πίσω στη σύνδεση',
      updatePasswordDescription: 'Διάλεξε νέο κωδικό για τον λογαριασμό σου.',
      passwordNewLabel: 'Νέος κωδικός',
      updatePasswordSubmit: 'Αποθήκευση κωδικού',
      passwordRequirementsError: 'Χρησιμοποίησε κωδικό που πληροί όλες τις προϋποθέσεις.',
      // Η βάση γράφει «Ενημέρωση Πληροφοριών Λογαριασμού», με κεφαλαία σε κάθε λέξη.
      loginProfileTitle: 'Ενημέρωση στοιχείων λογαριασμού',
      updateProfileDescription: 'Συμπλήρωσε τα στοιχεία σου για να συνεχίσεις.',
      updateProfileSubmit: 'Αποθήκευση και συνέχεια',
      termsTitle: 'Όροι Χρήσης',
      termsDescription: 'Διάβασε και αποδέξου τους Όρους Χρήσης για να συνεχίσεις.',
      termsReadLink: 'Διάβασε τους Όρους Χρήσης',
      // Πρώτο πρόσωπο, όπως και το «Συμφωνώ με τους» της εγγραφής.
      doAccept: 'Αποδέχομαι',
      doDecline: 'Δεν αποδέχομαι',
      emailVerifyTitle: 'Επιβεβαίωσε το email σου',
      emailVerifyInstruction1:
        'Στείλαμε σύνδεσμο επιβεβαίωσης στο {0}. Άνοιξέ τον για να συνεχίσεις.',
      emailVerifyNoAddress: 'Σου στείλαμε σύνδεσμο επιβεβαίωσης. Άνοιξέ τον για να συνεχίσεις.',
      emailVerifyNotReceived: 'Δεν έλαβες το email;',
      emailVerifyResend: 'Στείλ’ το ξανά',
      // Η βάση γράφει «Ο λογαριασμός υπάρχει ήδη», που ακούγεται σαν άρνηση.
      confirmLinkIdpTitle: 'Έχεις ήδη λογαριασμό',
      idpLinkConfirmDescription:
        'Υπάρχει ήδη λογαριασμός με αυτή τη διεύθυνση email. Μπορείς να συνδέσεις τους λογαριασμούς σου, ώστε να συνδέεσαι και με τους δύο τρόπους. Τα δεδομένα σου θα παραμείνουν αναλλοίωτα.',
      // Η βάση γράφει «Ο χρήστης {0} {1} υπάρχει ήδη. Σίγουρα να συνεχίσω;» — ρωτά κάτι που η
      // σελίδα απαντά ήδη με δύο κουμπιά, και σε πρώτο πρόσωπο. Το {0} είναι το όνομα του πεδίου
      // και δεν χρειάζεται: η τιμή που δείχνει είναι προφανώς διεύθυνση.
      federatedIdentityConfirmLinkMessage: 'Η διεύθυνση «{1}» υπάρχει ήδη',
      idpLinkConfirmSubmit: 'Σύνδεση λογαριασμών',
      idpLinkConfirmCancel: 'Θα μπω με άλλον τρόπο',
      emailLinkIdpTitle: 'Επιβεβαίωσε ότι είσαι εσύ',
      idpLinkEmailDescription:
        'Στείλαμε σύνδεσμο στο {0}. Άνοιξέ τον για να συνδέσεις τον λογαριασμό σου με {1}.',
      idpLinkEmailConfirmedElsewhere: 'Τον άνοιξα σε άλλη συσκευή',
      // Η βάση γράφει «Ενημέρωση Πληροφοριών Λογαριασμού». Εδώ δεν ενημερώνεται τίποτα — ο
      // λογαριασμός δεν υπάρχει ακόμη.
      loginIdpReviewProfileTitle: 'Συμπλήρωσε τα στοιχεία σου',
      // Η βάση γράφει «Λυπούμαστε...», που δεν λέει τι έγινε.
      errorTitle: 'Κάτι πήγε στραβά',
      pageExpiredTitle: 'Η σελίδα έληξε',
      pageExpiredDescription:
        'Έλειψες αρκετή ώρα και η σύνδεση διακόπηκε. Ξεκίνα ξανά ή συνέχισε από εκεί που έμεινες.',
      pageExpiredRestart: 'Ξεκίνα ξανά',
      pageExpiredContinue: 'Συνέχισε από εκεί που έμεινα',
      goToHome: 'Μετάβαση στην αρχική',
      accountUpdatedTitle: 'Ο λογαριασμός ενημερώθηκε',
      infoSuccessTitle: 'Έτοιμο',
      infoNoticeTitle: 'Κάτι ακόμη',
      infoRedirectCountdown: 'Μετάβαση στην αρχική σε {0} δευτερόλεπτα.',
      infoRedirectCountdownOne: 'Μετάβαση στην αρχική σε 1 δευτερόλεπτο.',
      infoStayOnPage: 'Μείνε σε αυτή τη σελίδα',

      // Τίτλοι και ετικέτες. Η βάση γράφει «Είσοδος στον λογαριασμό σας».
      loginAccountTitle: 'Είσοδος στον λογαριασμό σου',
      doForgotPassword: 'Ξέχασες τον κωδικό;',
      emailForgotTitle: 'Ξέχασες τον κωδικό;',
      // Η βάση μεταφράζει το «Submit» ως «Εφαρμογή», που είναι άλλη λέξη.
      doSubmit: 'Υποβολή',
      emailInstruction:
        'Γράψε το όνομα χρήστη ή τη διεύθυνση email σου και θα σου στείλουμε οδηγίες για να ορίσεις νέο κωδικό.',
      emailInstructionUsername:
        'Γράψε το όνομα χρήστη σου και θα σου στείλουμε οδηγίες για να ορίσεις νέο κωδικό.',
      backToApplication: '« Επιστροφή στην εφαρμογή',
      backToLogin: '« Επιστροφή στη σύνδεση',
      proceedWithAction: '» Πάτησε εδώ για να συνεχίσεις',

      // Αποτελέσματα. Τα διαβάζει η σελίδα `info.ftl`.
      // Δεν αποκαλύπτει αν υπάρχει ο λογαριασμός. Το Keycloak δείχνει την ίδια σελίδα και στις δύο περιπτώσεις.
      emailSentMessage:
        'Θα λάβεις mail σύντομα με οδηγίες, εφόσον η διεύθυνση που πληκτρολόγησες υπάρχει στο σύστημα.',
      emailVerifiedMessage: 'Η διεύθυνση email σου επιβεβαιώθηκε.',
      accountUpdatedMessage: 'Ο λογαριασμός σου ενημερώθηκε.',

      // Σφάλματα. Η βάση γράφει «Προχωρείστε», που δεν είναι λέξη.
      expiredActionMessage: 'Η ενέργεια έληξε. Συνδέσου ξανά για να συνεχίσεις.',
      expiredActionTokenSessionExistsMessage: 'Η ενέργεια έληξε. Ξεκίνα ξανά.',
      expiredCodeMessage: 'Ο χρόνος σύνδεσης έληξε. Συνδέσου ξανά.',
      missingUsernameMessage: 'Γράψε το όνομα χρήστη σου.',
      missingPasswordMessage: 'Γράψε τον κωδικό σου.',
      missingFirstNameMessage: 'Γράψε το όνομά σου.',
      missingLastNameMessage: 'Γράψε το επώνυμό σου.',
      missingEmailMessage: 'Γράψε τη διεύθυνση email σου.',
      // Η βάση γράφει «Παρακαλώ ορίστε αυτό το πεδίο.», που δεν λέει ούτε ποιο πεδίο ούτε τι
      // φταίει. Το βλέπει κάθε κενό υποχρεωτικό πεδίο στην εγγραφή και στα στοιχεία λογαριασμού.
      'error-user-attribute-required': 'Το πεδίο είναι υποχρεωτικό',
      termsAcceptanceRequired:
        'Πρέπει να αποδεχτείς τους Όρους Χρήσης για να δημιουργήσεις λογαριασμό.',
      accountDisabledMessage:
        'Ο λογαριασμός είναι απενεργοποιημένος. Επικοινώνησε με τον διαχειριστή.',
      cookieNotFoundMessage:
        'Δεν βρέθηκε το cookie της σύνδεσης. Βεβαιώσου ότι τα cookies είναι ενεργά και δοκίμασε ξανά.',
      emailSendErrorMessage: 'Η αποστολή του email απέτυχε. Δοκίμασε ξανά αργότερα.',
      // Η βάση γράφει «Δεν επιτρέπεται η πρόσβαση κατά τη ταυτοποίηση με {0}», που ακούγεται σαν
      // άρνηση του παρόχου. Ο επισκέπτης απλώς ακύρωσε στην οθόνη της Google.
      'access-denied-when-idp-auth': 'Η σύνδεση με {0} ακυρώθηκε',
      emailExistsMessage: 'Υπάρχει ήδη λογαριασμός με αυτό το email. Συνδέσου αντί να εγγραφείς.',

      // Ενέργειες που εκκρεμούν. Η βάση τις γράφει με Κεφαλαία Σε Κάθε Λέξη.
      'requiredAction.UPDATE_PASSWORD': 'Ενημέρωση κωδικού πρόσβασης',
      'requiredAction.UPDATE_PROFILE': 'Ενημέρωση προφίλ',
      'requiredAction.VERIFY_EMAIL': 'Επιβεβαίωση email',
      'requiredAction.UPDATE_EMAIL': 'Ενημέρωση email',
      'requiredAction.VERIFY_PROFILE': 'Επιβεβαίωση προφίλ',
      'requiredAction.CONFIGURE_RECOVERY_AUTHN_CODES': 'Δημιουργία κωδικών ανάκτησης',
      // Η βάση γράφει «Όροι και Συνθήκες». Συνθήκη είναι κάτι που υπογράφουν κράτη.
      'requiredAction.TERMS_AND_CONDITIONS': 'Όροι Χρήσης',
      'requiredAction.webauthn-register-passwordless': 'Εγγραφή κλειδιού χωρίς κωδικό',
      'requiredAction.delete_credential': 'Διαγραφή διαπιστευτηρίου',
      'requiredAction.idp_link': 'Σύνδεση παρόχου ταυτότητας',
      'requiredAction.update_user_locale': 'Ενημέρωση γλώσσας',
    },
  })
  .build();

export type I18n = typeof ofTypeI18n;
export { getI18n };
