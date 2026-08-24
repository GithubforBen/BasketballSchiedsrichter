import { expect, test, type Page } from '@playwright/test';
import { loginAs, SEED } from './helfer';

/**
 * Was die Seite nach draussen verraet.
 *
 * Die oeffentliche Ansicht steht ohne Anmeldung im Netz. Jede Adresse, die der
 * Browser dabei ausserhalb dieser Anwendung anfragt, uebertraegt die IP des
 * Besuchers an einen Dritten — dafuer braucht es einen Grund und einen Eintrag
 * in der Datenschutzerklaerung. Es gibt keinen solchen Grund, also darf es
 * auch keine solche Anfrage geben.
 *
 * Der Test haengt nicht an einem bestimmten Anbieter: er verbietet jede fremde
 * Herkunft. Wer morgen ein Symbol-Paket oder ein Analysewerkzeug einbindet,
 * faellt hier auf, ohne dass jemand daran gedacht haben muss.
 */

const collectForeignRequests = (page: Page, ownOrigin: string) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return;
    if (url.startsWith(ownOrigin)) return;
    foreign.push(`${request.resourceType()} ${url}`);
  });
  return foreign;
};

test.describe('Keine fremden Aufrufe', () => {
  test('die oeffentliche Ansicht laedt ausschliesslich aus der eigenen Anwendung', async ({
    page,
    baseURL,
  }) => {
    const foreign = collectForeignRequests(page, baseURL ?? '');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(foreign, `Fremde Anfragen:\n  ${foreign.join('\n  ')}`).toEqual([]);
  });

  test('auch die angemeldeten Bildschirme bleiben bei sich', async ({ page, baseURL }) => {
    await loginAs(page, SEED.jonas.phone);
    const foreign = collectForeignRequests(page, baseURL ?? '');
    for (const path of ['/kalender', '/spiele', '/profil', '/regeln', '/impressum']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
    }
    expect(foreign, `Fremde Anfragen:\n  ${foreign.join('\n  ')}`).toEqual([]);
  });
});

test.describe('Die Schrift kommt aus dem eigenen Haus', () => {
  test('Archivo wird ausgeliefert und ist tatsaechlich in Benutzung', async ({ page }) => {
    await page.goto('/');

    // Ausgeliefert: die Datei gibt es unter der erwarteten Adresse.
    const response = await page.request.get('/schriften/archivo-latin.woff2');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('font');

    /*
     * In Benutzung: `document.fonts` kennt Archivo als geladen. Ohne diese
     * Pruefung koennte die Datei liegen und die Seite trotzdem in der
     * Ersatzschrift erscheinen — der @font-face-Block waere dann still kaputt.
     */
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    const geladen = await page.evaluate(() =>
      [...document.fonts].some((face) => face.family.includes('Archivo') && face.status === 'loaded'),
    );
    expect(geladen).toBe(true);
  });

  test('die Lizenz liegt bei — die Schrift steht unter der Open Font License', async ({ page }) => {
    const response = await page.request.get('/schriften/OFL.txt');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('SIL OPEN FONT LICENSE');
  });
});
