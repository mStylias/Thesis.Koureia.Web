import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { injectSynaxUrl, provideSynaxApi, synaxUrl } from './index';

describe('synaxUrl', () => {
  it('builds versioned URLs under /api/v{n}/', () => {
    expect(synaxUrl('bookings', { version: 1 })).toBe('/api/v1/bookings');
    expect(synaxUrl('restaurants/abc', { version: 2 })).toBe('/api/v2/restaurants/abc');
  });

  it('accepts a minor version as a string, mirroring ApiVersion(1, 2)', () => {
    expect(synaxUrl('bookings', { version: '1.2' })).toBe('/api/v1.2/bookings');
    expect(synaxUrl('bookings', {}, { defaultVersion: '1.2' })).toBe('/api/v1.2/bookings');
  });

  it('builds non-versioned URLs under /{tag}/', () => {
    expect(synaxUrl('auth/login')).toBe('/auth/login');
  });

  it('applies the configured default version unless overridden', () => {
    const config = { defaultVersion: 1 };

    expect(synaxUrl('bookings', {}, config)).toBe('/api/v1/bookings');
    expect(synaxUrl('bookings', { version: 2 }, config)).toBe('/api/v2/bookings');
    expect(synaxUrl('auth/login', { version: null }, config)).toBe('/auth/login');
  });

  it('prepends the base URL, normalizing slashes', () => {
    const config = { baseUrl: 'https://api.example.com/', defaultVersion: 1 };

    expect(synaxUrl('/bookings', {}, config)).toBe('https://api.example.com/api/v1/bookings');
  });

  it('passes absolute URLs through untouched', () => {
    expect(synaxUrl('https://elsewhere.example.com/x', { version: 1 })).toBe(
      'https://elsewhere.example.com/x',
    );
  });
});

describe('injectSynaxUrl', () => {
  it('binds the provided config', () => {
    TestBed.configureTestingModule({
      providers: [provideSynaxApi({ baseUrl: 'https://api.example.com', defaultVersion: 1 })],
    });

    const url = runInInjectionContext(TestBed.inject(Injector), () => injectSynaxUrl());

    expect(url('bookings')).toBe('https://api.example.com/api/v1/bookings');
    expect(url('auth/login', { version: null })).toBe('https://api.example.com/auth/login');
  });

  it('falls back to relative URLs with no config provided', () => {
    TestBed.configureTestingModule({});

    const url = runInInjectionContext(TestBed.inject(Injector), () => injectSynaxUrl());

    expect(url('bookings', { version: 1 })).toBe('/api/v1/bookings');
  });
});
