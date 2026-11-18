import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PAGE_META, readPageMeta } from './page-meta';
import type { PageMeta } from './page-meta.types';

@Component({ template: '' })
class Blank {}

const META: PageMeta = {
  title: 'Barber House Κολωνάκι',
  description: null,
  image: null,
  indexable: true,
};

async function navigate(url: string): Promise<PageMeta | null> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        {
          path: 'shop',
          data: { [PAGE_META]: META },
          children: [{ path: '', component: Blank }],
        },
        { path: 'plain', component: Blank },
      ]),
    ],
  });
  await RouterTestingHarness.create(url);
  return readPageMeta(TestBed.inject(Router).routerState.snapshot.root);
}

describe('readPageMeta', () => {
  it('finds the head a parent route carries, from the leaf upward', async () => {
    await expect(navigate('/shop')).resolves.toBe(META);
  });

  it('answers null for a page whose head comes from the dictionary', async () => {
    await expect(navigate('/plain')).resolves.toBeNull();
  });
});
