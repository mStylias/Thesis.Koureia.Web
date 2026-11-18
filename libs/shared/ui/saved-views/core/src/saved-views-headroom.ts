import { InjectionToken, type Signal } from '@angular/core';

/**
 * The width a host has left for the strip, in CSS pixels.
 *
 * A DI token rather than an input because the strip is often rendered through
 * an outlet whose inputs a descriptor fixes once, while the width is measured
 * by the bar around it and changes per frame. A host that draws the strip
 * inline can bind `layout` instead and never provide this.
 *
 * Injected `{ optional: true }`: with no provider the strip has no limit.
 */
export const SAVED_VIEWS_HEADROOM = new InjectionToken<Signal<number>>('SAVED_VIEWS_HEADROOM');
