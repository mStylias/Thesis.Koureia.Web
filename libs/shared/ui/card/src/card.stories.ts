import { Component } from '@angular/core';
import { Button } from '@ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { Card } from './card';
import {
  CardBody,
  CardContent,
  CardFooter,
  CardHeader,
  CardMedia,
  CardSubtitle,
  CardTitle,
} from './card-parts';

const CARD_IMPORTS = [
  Card,
  CardBody,
  CardContent,
  CardFooter,
  CardHeader,
  CardMedia,
  CardSubtitle,
  CardTitle,
] as const;

/** A per-story description and the consumer-facing snippet shown by Storybook. */
const doc = (markdown: string, code: string, language = 'html') => ({
  docs: {
    description: { story: markdown },
    source: { code: code.trim(), language },
  },
});

const BASIC_CARD_SOURCE = `
<article libCard appearance="outlined">
  <div libCardBody>
    <header libCardHeader>
      <div>
        <h2 libCardTitle>Card title</h2>
        <p libCardSubtitle>Supporting information</p>
      </div>
    </header>
    <div libCardContent>A flexible surface for related content and actions.</div>
    <footer libCardFooter>
      <span>Metadata</span>
      <a href="#card-action">View details</a>
    </footer>
  </div>
</article>
`;

@Component({
  // Story-only wrapper; the public Card family uses attribute selectors.
  // oxlint-disable-next-line @angular-eslint/component-selector
  selector: 'lib-card-barbershop-demo',
  imports: [...CARD_IMPORTS, Button],
  template: `
    <article libCard appearance="elevated" class="shop-card">
      <figure libCardMedia>
        <img
          src="/images/photo.svg"
          alt="Ο χώρος του κουρείου The Copper Chair"
          width="1280"
          height="853"
        />
      </figure>

      <div libCardBody>
        <header libCardHeader>
          <div class="shop-heading">
            <h2 libCardTitle>
              <a class="shop-link" href="/barbershops/the-copper-chair">The Copper Chair</a>
            </h2>
            <p libCardSubtitle>Κουκάκι • 0,8 km</p>
          </div>
          <button
            libButton
            type="button"
            variant="text"
            size="sm"
            iconOnly
            rounded
            aria-label="Προσθήκη του The Copper Chair στα αγαπημένα"
          >
            <span aria-hidden="true">★</span>
          </button>
        </header>

        <div libCardContent>
          <p class="shop-rating" aria-label="4,8 από 5, από 127 αξιολογήσεις">
            <span aria-hidden="true">★ 4,8 • 127 αξιολογήσεις</span>
          </p>
          <p class="shop-address">Δημητρακοπούλου 42, Αθήνα</p>
          <ul class="shop-services" aria-label="Δημοφιλείς υπηρεσίες">
            <li>Κούρεμα</li>
            <li>Περιποίηση γενειάδας</li>
          </ul>
        </div>

        <footer libCardFooter>
          <span class="shop-price">Από €18</span>
          <a libButton href="/barbershops/the-copper-chair" size="sm">Διαθεσιμότητα</a>
        </footer>
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 24rem);
    }

    .shop-heading {
      min-width: 0;
    }

    .shop-link {
      color: inherit;
      text-decoration: none;
    }

    .shop-link:hover {
      color: var(--accent-text);
      text-decoration: underline;
      text-underline-offset: var(--space-1);
    }

    .shop-rating,
    .shop-address {
      margin: 0;
    }

    .shop-rating {
      color: var(--accent-text);
      font-weight: var(--weight-bold);
    }

    .shop-address {
      color: var(--text-secondary);
    }

    .shop-services {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .shop-services li {
      padding: var(--space-1) var(--space-3);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      background: var(--surface-2);
      border: var(--border-width-hairline) solid var(--border-subtle);
      border-radius: var(--radius-pill);
    }

    .shop-price {
      color: var(--text-primary);
      font-family: var(--font-mono);
      font-size: var(--text-sm);
      font-weight: var(--weight-medium);
      font-variant-numeric: tabular-nums;
    }
  `,
})
class BarbershopCardDemo {}

const meta: Meta<Card> = {
  title: 'Layout & Navigation/Card',
  component: Card,
  decorators: [
    moduleMetadata({
      imports: [...CARD_IMPORTS, BarbershopCardDemo],
    }),
  ],
  argTypes: {
    appearance: {
      control: 'select',
      options: ['outlined', 'elevated'],
    },
  },
  args: { appearance: 'outlined' },
  render: (args) => ({
    props: args,
    template: `
      <article libCard [appearance]="appearance" style="max-width: 24rem;">
        <div libCardBody>
          <header libCardHeader>
            <div>
              <h2 libCardTitle>Card title</h2>
              <p libCardSubtitle>Supporting information</p>
            </div>
          </header>
          <div libCardContent>
            A flexible surface for related content and actions.
          </div>
          <footer libCardFooter>
            <span>Metadata</span>
            <a href="#card-action">View details</a>
          </footer>
        </div>
      </article>
    `,
  }),
};

export default meta;
type Story = StoryObj<Card>;

export const Playground: Story = {
  parameters: doc(
    'Use the consumer-authored element that fits the document. The card supplies only the frame and layout.',
    BASIC_CARD_SOURCE,
  ),
};

export const Elevated: Story = {
  args: { appearance: 'elevated' },
  parameters: doc(
    'Use the elevated appearance when the card needs stronger separation from its surrounding surface.',
    BASIC_CARD_SOURCE.replace('appearance="outlined"', 'appearance="elevated"'),
  ),
};

export const WithMedia: Story = {
  render: () => ({
    template: `
      <article libCard style="max-width: 24rem;">
        <figure libCardMedia>
          <img
            src="/images/photo.svg"
            alt="A warmly lit barbershop interior"
            width="1280"
            height="853"
          />
        </figure>
        <div libCardBody>
          <h2 libCardTitle>Card with media</h2>
          <div libCardContent>Media stays edge-to-edge while the body keeps tokenized spacing.</div>
        </div>
      </article>
    `,
  }),
  parameters: doc(
    'CardMedia provides an edge-to-edge region while CardBody retains the card padding.',
    `
<article libCard>
  <figure libCardMedia>
    <img
      src="/images/photo.svg"
      alt="A warmly lit barbershop interior"
      width="1280"
      height="853" />
  </figure>
  <div libCardBody>
    <h2 libCardTitle>Card with media</h2>
    <div libCardContent>Media stays edge-to-edge while the body keeps tokenized spacing.</div>
  </div>
</article>
    `,
  ),
};

export const MediaFallback: Story = {
  render: () => ({
    template: `
      <article libCard style="max-width: 24rem;">
        <div libCardMedia aria-label="No photograph available">No photograph available</div>
        <div libCardBody>
          <h2 libCardTitle>Card without a photograph</h2>
          <div libCardContent>The media region also supports an accessible fallback.</div>
        </div>
      </article>
    `,
  }),
  parameters: doc(
    'The media region can contain an accessible text fallback when no useful image is available.',
    `
<article libCard>
  <div libCardMedia aria-label="No photograph available">No photograph available</div>
  <div libCardBody>
    <h2 libCardTitle>Card without a photograph</h2>
    <div libCardContent>The media region also supports an accessible fallback.</div>
  </div>
</article>
    `,
  ),
};

export const Barbershop: Story = {
  render: () => ({ template: '<lib-card-barbershop-demo />' }),
  parameters: doc(
    'A domain composition rather than a domain-specific Card API: the image, rating, address, services, price, favorite action, and navigation remain consumer-authored.',
    `
<article libCard appearance="elevated">
  <figure libCardMedia>
    <img src="/images/photo.svg" alt="Ο χώρος του κουρείου The Copper Chair" />
  </figure>
  <div libCardBody>
    <header libCardHeader>
      <div>
        <h2 libCardTitle><a href="/barbershops/the-copper-chair">The Copper Chair</a></h2>
        <p libCardSubtitle>Κουκάκι • 0,8 km</p>
      </div>
      <button libButton type="button" variant="text" size="sm" iconOnly rounded
        aria-label="Προσθήκη του The Copper Chair στα αγαπημένα">…</button>
    </header>
    <div libCardContent>…</div>
    <footer libCardFooter>
      <span>Από €18</span>
      <a libButton href="/barbershops/the-copper-chair" size="sm">Διαθεσιμότητα</a>
    </footer>
  </div>
</article>
    `,
  ),
};

export const Accessibility: Story = {
  parameters: doc(
    'Card preserves the authored element and adds no role, tabindex, or activation. Use an article for a standalone result, the correct heading level, native anchors for navigation, and native buttons for actions.',
    `
<article libCard>
  <div libCardBody>
    <h2 libCardTitle>
      <a href="/barbershops/acme">Acme Barbers</a>
    </h2>
    <div libCardContent>Address and services</div>
    <footer libCardFooter>
      <button type="button">Add to favorites</button>
    </footer>
  </div>
</article>
    `,
  ),
};
