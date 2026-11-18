import type { CompanyDetailsResponse, CompanyPhotoViewDto } from '../data/barbershops.api.types';

/** Test data only. A shop as `GET /api/v1/companies/{slug}` returns it. */
export function companyDetails(
  overrides: Partial<CompanyDetailsResponse> = {},
): CompanyDetailsResponse {
  return {
    id: 'e1b568b5-7c0c-15e8-0ae7-f17268c75c8e',
    slug: 'barber-house-kolonaki',
    name: 'Barber House Κολωνάκι',
    description: null,
    street: 'Σκουφά 28',
    neighborhood: 'Κολωνάκι',
    city: 'Αθήνα',
    region: 'Αττική',
    postalCode: '106 73',
    countryCode: 'GR',
    latitude: 37.9794,
    longitude: 23.7389,
    timezone: 'Europe/Athens',
    currency: 'EUR',
    logoUrl: 'https://images.test/logo.png',
    photos: companyPhotos(3),
    rating: { count: 128, average: 4.7 },
    serviceCategories: [
      {
        id: 'category-haircut',
        name: 'Κούρεμα',
        services: [
          { id: 'service-haircut', name: 'Ανδρικό κούρεμα', price: 15, durationMinutes: 30 },
          { id: 'service-kids', name: 'Παιδικό κούρεμα', price: 12.5, durationMinutes: 75 },
        ],
      },
      {
        id: 'category-beard',
        name: 'Γένια',
        services: [
          { id: 'service-beard', name: 'Περιποίηση γενιών', price: 10, durationMinutes: 60 },
        ],
      },
    ],
    uncategorizedServices: [{ id: 'service-wash', name: 'Λούσιμο', price: 5, durationMinutes: 10 }],
    barbers: [
      {
        id: 'staff-giorgos',
        displayName: 'Γιώργος Π.',
        initials: 'ΓΠ',
        avatarUrl: 'https://images.test/giorgos.jpg',
      },
      { id: 'staff-nikos', displayName: 'Νίκος Κ.', initials: 'ΝΚ', avatarUrl: null },
    ],
    ...overrides,
  };
}

/** Test data only. `count` photos, numbered from 1. */
export function companyPhotos(count: number): CompanyPhotoViewDto[] {
  return Array.from({ length: count }, (_, index) => ({
    url: `https://images.test/photo-${String(index + 1)}.jpg`,
    width: 1200,
    height: 800,
    altText: `Φωτογραφία ${String(index + 1)}`,
  }));
}
