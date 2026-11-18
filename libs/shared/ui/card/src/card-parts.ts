import { Component } from '@angular/core';

/** Edge-to-edge visual area. Usually applied to a `<figure>`. */
@Component({
  selector: '[libCardMedia]',
  template: '<ng-content />',
  styleUrl: './card-media.scss',
  host: { class: 'card-media' },
})
export class CardMedia {}

/** Padded layout area for the card's textual content and actions. */
@Component({
  selector: '[libCardBody]',
  template: '<ng-content />',
  styleUrl: './card-body.scss',
  host: { class: 'card-body' },
})
export class CardBody {}

/** Top row for the title group and optional supporting action. */
@Component({
  selector: '[libCardHeader]',
  template: '<ng-content />',
  styleUrl: './card-header.scss',
  host: { class: 'card-header' },
})
export class CardHeader {}

/** Card title decoration. Apply it to the correct semantic heading level. */
@Component({
  selector: '[libCardTitle]',
  template: '<ng-content />',
  styleUrl: './card-title.scss',
  host: { class: 'card-title' },
})
export class CardTitle {}

/** Muted supporting copy directly associated with the card title. */
@Component({
  selector: '[libCardSubtitle]',
  template: '<ng-content />',
  styleUrl: './card-subtitle.scss',
  host: { class: 'card-subtitle' },
})
export class CardSubtitle {}

/** Main descriptive content of the card. */
@Component({
  selector: '[libCardContent]',
  template: '<ng-content />',
  styleUrl: './card-content.scss',
  host: { class: 'card-content' },
})
export class CardContent {}

/** Bottom row for concise metadata and actions. */
@Component({
  selector: '[libCardFooter]',
  template: '<ng-content />',
  styleUrl: './card-footer.scss',
  host: { class: 'card-footer' },
})
export class CardFooter {}
