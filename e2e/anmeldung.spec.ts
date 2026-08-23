import { expect, test, type Page } from '@playwright/test';
import { closeDb, latestLoginMessage, loginMessageCount, resetLoginState } from './db';

/**
 * Der Anmeldevorgang von Anfang bis Ende, gegen den Produktionsbuild.
 *
 * Link und Code kommen aus der Outbox in der Datenbank — im Kanal "dev" geht
 * keine Nachricht hinaus.
 */

const ADMIN_PHONE = '0157 220671';
const ADMIN_PHONE_E164 = '+49157220671';
const ADMIN_NAME = 'Nele Baumann';

/**
 * Fordert einen Zugang an und kehrt erst zurueck, wenn der Server geantwortet
 * hat — entweder mit der Bestaetigung oder mit einer Fehlermeldung. Ohne dieses
 * Warten laese der naechste Schritt die Outbox, bevor die Nachricht darin steht.
 */
const requestAccess = async (page: Page, phone: string): Promise<void> => {
  await page.goto('/anmelden');
  await page.getByLabel('Telefonnummer').fill(phone);
  await page.getByRole('button', { name: 'Zugang anfordern' }).click();
  await expect(
    page.locator('.form-success, p.form-error'),
    'weder Bestätigung noch Fehlermeldung nach dem Absenden',
  ).toBeVisible();
};

const codeStep = (phone: string) => `/anmelden?schritt=code&tel=${encodeURIComponent(phone)}`;

/**
 * Die Fehlermeldung des Formulars.
 *
 * Nicht ueber getByRole('alert'): Next haengt einen eigenen, leeren Bereich mit
 * derselben Rolle in die Seite (den Routen-Ansager fuer Screenreader), und der
 * wuerde die Auswahl mehrdeutig machen.
 */
const formError = (page: Page) => page.locator('p.form-error');

/**
 * Der angemeldete Name in der Kopfzeile.
 *
 * Nicht ueber getByText: der Name steht zweimal in der Seite — sichtbar und
 * als Beschriftung des Kuerzels fuer Screenreader. Beides ist beabsichtigt,
 * also muss der Test genauer hinsehen.
 */
const topbar = (page: Page) => page.locator('.shell-topbar');

test.describe('Anmeldung', () => {
  test.beforeEach(async () => {
    await resetLoginState();
  });

  test.afterAll(async () => {
    await closeDb();
  });

  test('schickt Link und Code und meldet über den Link an', async ({ page }) => {
    await requestAccess(page, ADMIN_PHONE);
    await expect(page.getByText(/ist die Nachricht unterwegs/)).toBeVisible();
    // Die Bestätigung nennt die Nummer nur verdeckt.
    await expect(page.getByText(/•••/)).toBeVisible();

    const { link } = await latestLoginMessage();
    await page.goto(link);

    await expect(topbar(page)).toContainText(ADMIN_NAME);
    await expect(page.getByRole('heading', { name: 'Spielplan', level: 1 })).toBeVisible();
  });

  test('meldet auch über den Code an', async ({ page }) => {
    await requestAccess(page, ADMIN_PHONE);
    const { code } = await latestLoginMessage();

    await page.goto(codeStep(ADMIN_PHONE_E164));
    await page.getByLabel('Code aus der Nachricht').fill(code);
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(topbar(page)).toContainText(ADMIN_NAME);
  });

  test('lässt denselben Link kein zweites Mal gelten', async ({ page, context }) => {
    await requestAccess(page, ADMIN_PHONE);
    const { link } = await latestLoginMessage();
    await page.goto(link);
    await expect(topbar(page)).toContainText(ADMIN_NAME);

    // Ein zweiter Zugriff mit demselben Link kommt nicht mehr hinein.
    await context.clearCookies();
    await page.goto(link);
    await expect(formError(page)).toContainText(/gilt nicht mehr|bereits benutzt/);
    await expect(topbar(page)).not.toContainText(ADMIN_NAME);
  });

  test('entwertet den Code, sobald der Link benutzt wurde', async ({ page, context }) => {
    await requestAccess(page, ADMIN_PHONE);
    const { link, code } = await latestLoginMessage();
    await page.goto(link);
    await expect(topbar(page)).toContainText(ADMIN_NAME);

    await context.clearCookies();
    await page.goto(codeStep(ADMIN_PHONE_E164));
    await page.getByLabel('Code aus der Nachricht').fill(code);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(formError(page)).toBeVisible();
    await expect(topbar(page)).not.toContainText(ADMIN_NAME);
  });

  test('weist einen falschen Code zurück und sagt, wie viele Versuche bleiben', async ({ page }) => {
    await requestAccess(page, ADMIN_PHONE);
    await latestLoginMessage();

    await page.goto(codeStep(ADMIN_PHONE_E164));
    await page.getByLabel('Code aus der Nachricht').fill('000000');
    await page.getByRole('button', { name: 'Anmelden' }).click();

    await expect(formError(page)).toContainText(/stimmt nicht/);
    await expect(formError(page)).toContainText(/Versuch/);
  });

  test('erklärt eine unbrauchbare Telefonnummer, ohne etwas zu verschicken', async ({ page }) => {
    await requestAccess(page, 'Telefon');
    await expect(formError(page)).toContainText(/Ziffern|Vorwahl/);
    expect(await loginMessageCount()).toBe(0);
  });

  test('verrät nicht, ob es eine Nummer gibt', async ({ page }) => {
    await requestAccess(page, '0151 99999999');
    await expect(page.getByText(/ist die Nachricht unterwegs/)).toBeVisible();
    // Dieselbe Antwort wie bei einer bekannten Nummer — und trotzdem nichts verschickt.
    expect(await loginMessageCount()).toBe(0);
  });

  test('sperrt nach drei Anforderungen für dieselbe Nummer', async ({ page }) => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await requestAccess(page, ADMIN_PHONE);
      await expect(page.getByText(/ist die Nachricht unterwegs/)).toBeVisible();
    }
    await requestAccess(page, ADMIN_PHONE);
    await expect(formError(page)).toContainText(/Telefonnummer/);
  });

  test('meldet wieder ab', async ({ page }) => {
    await requestAccess(page, ADMIN_PHONE);
    const { link } = await latestLoginMessage();
    await page.goto(link);
    await expect(topbar(page)).toContainText(ADMIN_NAME);

    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(topbar(page)).toContainText('nicht angemeldet');
    await expect(topbar(page)).not.toContainText(ADMIN_NAME);
  });
});
