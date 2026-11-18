import type { Translation } from '@jsverse/transloco';

const el: Translation = {
  label: 'Αριθμός τηλεφώνου',
  errors: {
    required: 'Ο αριθμός τηλεφώνου είναι υποχρεωτικός',
    phoneTooShort: 'Ο αριθμός είναι πολύ σύντομος',
    phoneTooLong: 'Ο αριθμός είναι πολύ μεγάλος',
    phoneInvalidCountry: 'Μη έγκυρος κωδικός χώρας',
    phoneInvalidType: 'Αυτός ο τύπος αριθμού δεν γίνεται δεκτός',
    phoneGreekMobile: 'Εισαγάγετε έγκυρο ελληνικό κινητό (ξεκινά από 69)',
    phoneInvalid: 'Μη έγκυρος αριθμός τηλεφώνου',
  },
};

export default el;
