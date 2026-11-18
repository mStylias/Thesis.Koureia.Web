/**
 * Google Maps directions to a point. The same URL opens the Google Maps app on a phone that has
 * it, and the web map everywhere else.
 */
export function directionsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinates(latitude, longitude)}`;
}

/** A point pinned in Google Maps, in the app on a phone that has it. */
export function placeUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coordinates(latitude, longitude)}`;
}

function coordinates(latitude: number, longitude: number): string {
  return encodeURIComponent(`${String(latitude)},${String(longitude)}`);
}
