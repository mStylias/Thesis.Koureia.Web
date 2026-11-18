import { AddressInfo } from 'node:net';
import { Server, request as httpRequest } from 'node:http';

import express from 'express';

import { redirectToCanonicalHost } from './canonical-host';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(closeServer));
});

describe('canonical host redirect', () => {
  it('permanently redirects www while preserving the path and query', async () => {
    const baseUrl = await startServer();

    const response = await requestWithHost(
      `${baseUrl}/auth/sign-in?returnUrl=%2Fprofile`,
      'www.koureia.gr',
    );

    expect(response.status).toBe(308);
    expect(response.location).toBe('https://koureia.gr/auth/sign-in?returnUrl=%2Fprofile');
  });

  it('uses the forwarded host supplied by the production proxy', async () => {
    const baseUrl = await startServer();

    const response = await fetch(`${baseUrl}/barbershops`, {
      headers: { Host: 'internal-proxy', 'X-Forwarded-Host': 'www.koureia.gr' },
      redirect: 'manual',
    });

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://koureia.gr/barbershops');
  });

  it.each(['koureia.gr', 'localhost:6100', '127.0.0.1:6100'])(
    'continues normally for %s',
    async (host) => {
      const baseUrl = await startServer();

      const response = await fetch(baseUrl, { headers: { Host: host }, redirect: 'manual' });

      expect(response.status).toBe(204);
    },
  );
});

async function startServer(): Promise<string> {
  const app = express();
  app.use(redirectToCanonicalHost);
  app.use((_request, response) => response.sendStatus(204));

  const server = app.listen(0, '127.0.0.1');
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}

function requestWithHost(
  url: string,
  host: string,
): Promise<{ status: number; location?: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers: { Host: host } }, (response) => {
      response.resume();
      resolve({
        status: response.statusCode ?? 0,
        location: response.headers.location,
      });
    });
    request.once('error', reject);
    request.end();
  });
}
