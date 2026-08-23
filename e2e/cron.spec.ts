import { expect, test } from '@playwright/test';

/**
 * Der Cron-Endpunkt im ausgelieferten Produktionsbuild.
 *
 * Die Zugangspruefung selbst hat ihre eigenen Tests. Hier geht es um etwas,
 * das nur der echte Build zeigen kann: dass es den Pfad ueberhaupt gibt und
 * dass er verschlossen ist. Ein offener Endpunkt hiesse, dass jeder Fremde
 * Nachrichten ausloesen kann — und jede Nachricht kostet den Verein Geld
 * (Regel 33).
 */

test.describe('Cron-Endpunkt', () => {
  test('lehnt einen Lauf ohne Schluessel ab', async ({ request }) => {
    const response = await request.post('/api/cron');
    expect(response.status()).toBe(401);
  });

  test('lehnt auch den Trockenlauf ohne Schluessel ab', async ({ request }) => {
    const response = await request.get('/api/cron');
    expect(response.status()).toBe(401);
  });

  test('lehnt einen erratenen Schluessel ab', async ({ request }) => {
    const response = await request.post('/api/cron', {
      headers: { authorization: 'Bearer geraten' },
    });
    expect(response.status()).toBe(401);
  });
});
