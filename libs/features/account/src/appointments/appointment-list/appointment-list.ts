import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { AppointmentPeriod, AppointmentResponse } from '@api/customer-appointments';
import { Banner } from '@ui/banner';
import { Button } from '@ui/button';
import { LangLink } from '@util/language';

import type { PagedList } from '../../account.types';
import { AppointmentCard } from '../appointment-card/appointment-card';

/** One period's appointments: its loading, failure and empty states, the cards, "Show more". */
@Component({
  selector: 'lib-appointment-list',
  imports: [AppointmentCard, Banner, Button, LangLink, TranslocoPipe],
  templateUrl: './appointment-list.html',
  styleUrl: './appointment-list.scss',
})
export class AppointmentList {
  readonly list = input.required<PagedList<AppointmentResponse>>();
  readonly period = input.required<AppointmentPeriod>();

  /** The first page failed and the customer asked again. */
  readonly retry = output();
  /** "Show more" was pressed. */
  readonly more = output();
  /** "Rate this visit" was pressed on a card. */
  readonly rate = output<AppointmentResponse>();
}
