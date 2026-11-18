# Barbershops feature

Lazy-loaded `/barbershops` page with a responsive OpenFreeMap map powered by
MapLibre GL JS.

## The origin

The list is always ordered from one point, and `BarbershopFilters.origin` is it.
`null` means the API's own configured default — the page never names those
coordinates itself. Otherwise the point comes from a place the visitor chose
(`places.api.ts`, over `GET /api/v1/places`) or from the browser's Geolocation
API (`device-location.ts`). One concept, two sources, so the device path needs no
code of its own past the button.

An origin **reorders and never narrows**, which is why `isFiltered` ignores it —
an empty list with an origin set is empty full stop, not filtered to nothing. It
does move the request off the cached `companies/all` endpoint, which is measured
from the default and would otherwise quietly answer for the wrong place.

An origin also takes the map's camera off automatic framing: it pins the point,
pans to it at the current zoom, and leaves the recenter button as the way back to
a view of every shop.

The endpoint does not exist yet.

## Running unit tests

Run `nx test features-barbershops` to execute the unit tests.
