import { expect, test, type Page } from '@playwright/test';
import { resetLoginState } from './db';
import { formError, formSuccess, loginAs, SEED, topbar } from './helfer';

/**
 * Der Anmeldevorgang von Anfang bis Ende, gegen den Produktionsbuild.
 *
 * Angemeldet wird mit Telefonnummer und Passwort (Regel 34). Der Weg über einen
 * zugeschickten Link ist gebaut, steht aber zu — jede Anmeldung kostete dabei
 * eine Nachricht, und der Verein hat 2000 im Monat.
 */

const ADMIN = SEED.nele;
const ADMIN_PASSWORD = 'nelebaumann';

const submit = async (page: Page, phone: string, password: string): Promise<void> => {
  await page.goto('/anmelden');
  await page.getByLabel('Telefonnummer').fill(phone);
  await page.getByLabel('Passwort').fill(password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
};

test.describe('Anmeldung mit Passwort', () => {
  test.beforeEach(async ({ page }) => {
    await resetLoginState();
    await page.context().clearCookies();
  });

  test('meldet mit Telefonnummer und Passwort an', async ({ page }) => {
    await submit(page, ADMIN.phone, ADMIN_PASSWORD);

    await expect(topbar(page)).toContainText(ADMIN.name);
    // Nach dem Login öffnet sich zuerst „Kalender & Verlauf“ — so steht es im
    // Mockup, und so merkt sich die App später den zuletzt benutzten Bildschirm.
    await expect(page.getByRole('heading', { name: /Kalender/, level: 1 })).toBeVisible();
  });

  test('nimmt die Nummer in jeder Schreibweise an — Regel 42', async ({ page }) => {
    for (const written of ['0157 220671', '+49157220671', '+49 157 220671', '0157/220671']) {
      await page.context().clearCookies();
      await submit(page, written, ADMIN_PASSWORD);
      await expect(topbar(page), `"${written}" kam nicht durch`).toContainText(ADMIN.name);
    }
  });

  test('weist ein falsches Passwort zurück', async ({ page }) => {
    await submit(page, ADMIN.phone, 'falschespasswort');
    await expect(formError(page)).toContainText(/stimmt nicht/);
    await expect(topbar(page)).not.toContainText(ADMIN.name);
  });

  test('verrät nicht, ob es eine Nummer gibt', async ({ page }) => {
    await submit(page, '0151 99999999', 'irgendwas');
    const unbekannt = await formError(page).textContent();

    await submit(page, ADMIN.phone, 'falschespasswort');
    const falsch = await formError(page).textContent();

    // Dieselbe Antwort — sonst wäre die Anmeldeseite ein Verzeichnis, mit dem
    // sich prüfen ließe, wer im Verein pfeift.
    expect(unbekannt).toBe(falsch);
  });

  test('behält die Nummer im Feld, wenn das Passwort nicht stimmt', async ({ page }) => {
    await submit(page, '+49 157 220671', 'falschespasswort');
    // Und zwar in der Form aus Regel 43, damit sichtbar wird, was die App
    // verstanden hat.
    await expect(page.getByLabel('Telefonnummer')).toHaveValue('0157 220671');
  });

  test('erklärt eine unbrauchbare Telefonnummer', async ({ page }) => {
    await submit(page, 'Telefon', 'egal');
    await expect(formError(page)).toContainText(/Ziffern|Vorwahl/);
  });

  test('zeigt den Weg über einen Link nicht an, solange er ausgeschaltet ist', async ({ page }) => {
    await page.goto('/anmelden');
    await expect(page.getByRole('button', { name: /Link schicken/ })).toHaveCount(0);
    await expect(page.getByText(/Ein Admin der Abteilung setzt es zurück/)).toBeVisible();

    // Auch von Hand ist der zweite Schritt nicht zu erreichen.
    await page.goto('/anmelden?schritt=code&tel=%2B49157220671');
    await expect(page.getByLabel('Passwort')).toBeVisible();
    await expect(page.getByLabel('Code aus der Nachricht')).toHaveCount(0);
  });

  test('meldet wieder ab', async ({ page }) => {
    await loginAs(page, ADMIN.phone);
    // Der Knopf aus der Kopfzeile: „Abmelden" steht auf jeder Seite oben und im
    // Profil noch einmal, und beide sollen dasselbe tun.
    await topbar(page).getByRole('button', { name: 'Abmelden' }).click();
    await expect(topbar(page)).toContainText('nicht angemeldet');
    await expect(topbar(page)).not.toContainText(ADMIN.name);
  });
});

test.describe('Passwort ändern — Regeln 37 und 38', () => {
  test.beforeEach(async ({ page }) => {
    await resetLoginState();
    await page.context().clearCookies();
  });

  test('ändert das eigene Passwort und meldet damit wieder an', async ({ page }) => {
    const neu = 'mein hund heisst bello';
    await loginAs(page, SEED.lena.phone);

    await page.goto('/passwort');
    await page.getByLabel('Bisheriges Passwort').fill('lenabrandt');
    await page.getByLabel('Neues Passwort', { exact: true }).fill(neu);
    await page.getByLabel('Neues Passwort wiederholen').fill(neu);
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(formSuccess(page)).toContainText(/geändert/);

    await page.context().clearCookies();
    await submit(page, SEED.lena.phone, neu);
    await expect(topbar(page)).toContainText(SEED.lena.name);

    // Zurück auf den Ausgangszustand, damit die Suite wiederholbar bleibt.
    await page.goto('/passwort');
    await page.getByLabel('Bisheriges Passwort').fill(neu);
    await page.getByLabel('Neues Passwort', { exact: true }).fill('lenabrandt');
    await page.getByLabel('Neues Passwort wiederholen').fill('lenabrandt');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(formSuccess(page)).toContainText(/geändert/);
  });

  test('verlangt das bisherige Passwort und eine passende Wiederholung', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/passwort');

    await page.getByLabel('Bisheriges Passwort').fill('geraten');
    await page.getByLabel('Neues Passwort', { exact: true }).fill('neu');
    await page.getByLabel('Neues Passwort wiederholen').fill('neu');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(formError(page)).toContainText(/bisherige Passwort stimmt nicht/);

    await page.getByLabel('Bisheriges Passwort').fill('jonaskeller');
    await page.getByLabel('Neues Passwort', { exact: true }).fill('eins');
    await page.getByLabel('Neues Passwort wiederholen').fill('zwei');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(formError(page)).toContainText(/nicht gleich/);

    // Das alte Passwort muss weiter gelten — sonst hätten die Fehlversuche
    // etwas verstellt.
    await page.context().clearCookies();
    await submit(page, SEED.jonas.phone, 'jonaskeller');
    await expect(topbar(page)).toContainText(SEED.jonas.name);
  });
});
