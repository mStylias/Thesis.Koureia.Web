/** Decodes base64url, the form of the VAPID key, to the bytes `PushManager.subscribe` takes. */
export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Whether a subscription was made with this key. A changed key needs a new subscription. */
export function sameKey(subscriptionKey: ArrayBuffer | null, publicKey: string): boolean {
  if (subscriptionKey === null) return false;
  const left = new Uint8Array(subscriptionKey);
  const right = decodeBase64Url(publicKey);
  return left.length === right.length && left.every((byte, index) => byte === right[index]);
}
