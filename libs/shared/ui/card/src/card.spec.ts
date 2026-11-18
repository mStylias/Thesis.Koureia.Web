import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Card, CardAppearance } from './card';
import {
  CardBody,
  CardContent,
  CardFooter,
  CardHeader,
  CardMedia,
  CardSubtitle,
  CardTitle,
} from './card-parts';

@Component({
  imports: [
    Card,
    CardBody,
    CardContent,
    CardFooter,
    CardHeader,
    CardMedia,
    CardSubtitle,
    CardTitle,
  ],
  template: `
    <article libCard class="consumer-card" [appearance]="appearance()">
      <figure libCardMedia>
        <img src="/shop.webp" alt="Inside Acme Barbers" />
      </figure>
      <div libCardBody>
        <header libCardHeader>
          <div>
            <h2 libCardTitle><a href="/barbershops/acme">Acme Barbers</a></h2>
            <p libCardSubtitle>Κουκάκι • 0,8 km</p>
          </div>
          <button type="button">Favorite</button>
        </header>
        <div libCardContent>★ 4,8 • 127 αξιολογήσεις</div>
        <footer libCardFooter>Από €18</footer>
      </div>
    </article>
  `,
})
class Host {
  readonly appearance = signal<CardAppearance>('outlined');
}

describe('Card', () => {
  let fixture: ComponentFixture<Host>;
  let card: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
    }).compileComponents();

    fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const renderedCard = host.querySelector('article');
    if (!renderedCard) {
      throw new Error('expected a semantic card host');
    }
    card = renderedCard;
  });

  it('decorates the consumer semantic element and projects its content', () => {
    expect(card.tagName).toBe('ARTICLE');
    expect(card.classList.contains('card')).toBe(true);
    expect(card.classList.contains('consumer-card')).toBe(true);
    expect(card.querySelector('h2')?.textContent).toContain('Acme Barbers');
    expect(card.querySelector('a')?.getAttribute('href')).toBe('/barbershops/acme');
    expect(card.querySelector('button')?.textContent).toContain('Favorite');
  });

  it('defaults to the outlined appearance', () => {
    expect(card.getAttribute('data-appearance')).toBe('outlined');
  });

  it('reacts to appearance input changes', async () => {
    fixture.componentInstance.appearance.set('elevated');
    await fixture.whenStable();

    expect(card.getAttribute('data-appearance')).toBe('elevated');
  });

  it('does not add interaction or ARIA semantics to the card frame', () => {
    expect(card.hasAttribute('role')).toBe(false);
    expect(card.hasAttribute('tabindex')).toBe(false);
    expect(card.getAttribute('aria-label')).toBeNull();
  });

  it('decorates every structural part without replacing native semantics', () => {
    expect(card.querySelector('figure.card-media')).not.toBeNull();
    expect(card.querySelector('div.card-body')).not.toBeNull();
    expect(card.querySelector('header.card-header')).not.toBeNull();
    expect(card.querySelector('h2.card-title')).not.toBeNull();
    expect(card.querySelector('p.card-subtitle')).not.toBeNull();
    expect(card.querySelector('div.card-content')).not.toBeNull();
    expect(card.querySelector('footer.card-footer')).not.toBeNull();
  });
});
