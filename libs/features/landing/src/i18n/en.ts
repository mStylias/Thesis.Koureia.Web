import type { Translation } from '@jsverse/transloco';

/**
 * Brand-bearing copy is deliberately absent — it lives in each app's root
 * dictionary under `brand.landing.*`. See `LandingBrandCopy` for why.
 */
const en: Translation = {
  navigation: {
    skip: 'Skip to content',
  },
  hero: {
    eyebrow: 'Find your barbershop',
    title: 'Book your next haircut, online.',
    staffTitle: "Navigate your barbershop's management",
    lead: 'Find the barbershop that suits you, choose a service and book the time that works for you.',
    staffLead: 'There you can manage your appointments and your barbershop',
    scrollLabel: 'Scroll to see how it works',
  },
  customerJourney: {
    eyebrow: 'How it works',
    title: 'Your appointment in three simple steps',
    lead: 'From searching to the barber chair, everything happens simply and clearly.',
    stepOne: {
      title: 'Find a barbershop',
      body: 'Discover barbershops and choose one that suits your style and neighbourhood.',
    },
    stepTwo: {
      title: 'Choose a service',
      body: 'See the services and choose exactly what you need.',
    },
    stepThree: {
      title: 'Book an appointment',
      body: 'Pick an available time and book your next haircut in a few steps.',
    },
  },
  auth: {
    eyebrow: 'Your account',
    title: 'Your appointments, in one place',
    // Says what an account is *for*, and says the same amount about each of the two
    // actions. Neither is the small print of the other.
    lead: 'Sign in to see your appointments and book faster next time. New here? Creating an account takes a moment.',
  },
  howPage: {
    eyebrow: 'For barbershops',
    lead: 'The tools you need to organise your barbershop and accept online bookings.',
  },
  workflow: {
    eyebrow: 'Start simply',
    title: 'Ready for your barbershop',
    lead: 'From your first profile to your first online booking, everything follows a natural order.',
    stepOne: {
      title: 'Set up your profile',
      body: 'Add your barbershop, services and the hours you actually work.',
    },
    stepTwo: {
      title: 'Organise your day',
      body: 'See availability at a glance and leave room for what happens in the shop.',
    },
    stepThree: {
      title: 'Accept bookings',
      body: 'Clients choose a time online while you keep a clear view of your day.',
    },
  },
  features: {
    eyebrow: 'The right rhythm',
    title: 'A clear schedule. A better day.',
    lead: 'Everything you need to leave notes and phone calls behind the chair.',
    booking: {
      title: 'Booking page',
      body: 'One clear place to find services and available times.',
    },
    calendar: {
      title: 'A calendar that makes sense',
      body: 'Bookings, changes and your time in one calm view.',
    },
    reminders: {
      title: 'Timely reminders',
      body: 'Fewer misunderstandings without messaging people one by one.',
    },
    previewDay: 'Wednesday, 16 July',
    previewTitle: 'Your schedule',
    previewCount: '3 bookings',
    appointmentHaircut: 'Haircut',
    appointmentHaircutBeard: 'Haircut + beard',
    thirtyMinutes: '30 min',
    fortyFiveMinutes: '45 min',
  },
  cta: {
    eyebrow: 'For the first barbershops',
    lead: 'If you want to organise bookings better from the start, join the first people to use it.',
    book: 'Book an appointment',
    management: 'Go to management',
    pointOne: 'Simple setup, no technical knowledge needed',
    pointTwo: 'Built around the real rhythm of a barbershop',
    pointThree: 'Your feedback helps us make it better',
  },
};

export default en;
