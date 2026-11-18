import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  label: 'Κωδικός πρόσβασης',
  show: 'Εμφάνιση κωδικού',
  clear: 'Καθαρισμός',
  requirementsIntro: 'Ο κωδικός πρέπει να περιλαμβάνει:',
  rules: {
    minLength: 'τουλάχιστον {{min}} χαρακτήρες',
    uppercase: 'ένα κεφαλαίο γράμμα',
    lowercase: 'ένα πεζό γράμμα',
    digit: 'έναν αριθμό',
    special: 'έναν ειδικό χαρακτήρα',
  },
  strength: {
    label: 'Ισχύς κωδικού',
    none: 'Εισαγάγετε κωδικό',
    veryWeak: 'Πολύ αδύναμος',
    weak: 'Αδύναμος',
    fair: 'Μέτριος',
    good: 'Καλός',
    strong: 'Ισχυρός',
  },
  // Sentences the live region joins once typing pauses.
  announce: {
    strength: 'Ισχύς: {{strength}}.',
    progress: '{{met}} από {{total}} απαιτήσεις καλύπτονται.',
    complete: 'Όλες οι απαιτήσεις καλύπτονται.',
    missing: 'Λείπει: {{rules}}.',
    separator: ', ',
  },
  errors: {
    required: 'Ο κωδικός πρόσβασης είναι υποχρεωτικός',
    password: {
      minLength: 'Ο κωδικός πρέπει να έχει τουλάχιστον {{min}} χαρακτήρες',
      uppercase: 'Ο κωδικός πρέπει να περιλαμβάνει ένα κεφαλαίο γράμμα',
      lowercase: 'Ο κωδικός πρέπει να περιλαμβάνει ένα πεζό γράμμα',
      digit: 'Ο κωδικός πρέπει να περιλαμβάνει έναν αριθμό',
      special: 'Ο κωδικός πρέπει να περιλαμβάνει έναν ειδικό χαρακτήρα',
    },
    passwordInvalid: 'Ο κωδικός δεν πληροί τις απαιτήσεις',
  },
};

export default el;
