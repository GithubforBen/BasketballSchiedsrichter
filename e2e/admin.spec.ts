import { expect, test } from '@playwright/test';
import {
  auditCount,
  countGamesLike,
  dropGamesLike,
  hasQualification,
  markRelocated,
  placeReferee,
  resetAssignments,
  resetSettings,
  setQualificationDirect,
  upcomingGameIds,
  withdrawDeadline,
} from './db';
import { expectNoHorizontalScroll, formError, formSuccess, loginAs, SEED } from './helfer';

/**
 * Der Adminbereich im Browser.
 *
 * Der Schwerpunkt liegt auf dem, was der Review von Meilenstein 4 verlangt:
 * jede Aktion hinterlässt einen Eintrag im Prüfprotokoll, das Verschieben
 * erreicht Schiedsrichter und Ersatz, und der Import ist wiederholbar.
 */

const TESTMARKE = 'E2E-Testverein';

/**
 * Bezugspunkt einmal festgehalten: zwei Aufrufe im selben Test dürfen nicht
 * um Mitternacht auf verschiedene Kalendertage fallen — der zweite Import
 * würde sonst andere Spiele erzeugen statt Duplikate zu erkennen.
 */
const STARTED_AT = Date.now();

const csvFor = (dayOffset: number, suffix = '') => {
  const date = new Date(STARTED_AT + dayOffset * 24 * 60 * 60 * 1000);
  const german = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  return [
    'Datum;Zeit;Liga;Heim;Gast;Ort',
    `${german};10:00;U14;${TESTMARKE}${suffix};Gastverein;Testhalle`,
    `${german};12:00;U16;${TESTMARKE}2${suffix};Gastverein;Testhalle`,
  ].join('\n');
};

test.describe('Adminbereich', () => {
  test.beforeEach(async () => {
    await resetAssignments();
    await dropGamesLike(`${TESTMARKE}%`);
    await resetSettings();
  });

  test.afterAll(async () => {
    await dropGamesLike(`${TESTMARKE}%`);
  });

  test('zeigt die Zahlen und alle Spieltage', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/uebersicht');

    await expect(page.getByRole('heading', { name: 'Spielübersicht', level: 1 })).toBeVisible();
    await expect(page.locator('.kpi-row li')).toHaveCount(4);
    await expect(page.getByText('Spiele geplant')).toBeVisible();
    await expect(page.locator('.matchday-title').first()).toBeVisible();
  });

  test('sperrt den Adminbereich für Schiedsrichter', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    for (const path of ['/uebersicht', '/meldungen', '/schiris', '/einstellungen']) {
      await page.goto(path);
      await expect(page, `${path} war erreichbar`).toHaveURL(/\/spiele/);
    }
  });

  test('führt Meldungen auf und lässt daraus handeln', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/meldungen');

    await expect(page.locator('.alert').first()).toBeVisible();
    await page.getByRole('button', { name: /Erinnerung senden|Ersatz anfordern|nachfassen/ }).first().click();
    await expect(formSuccess(page)).toBeVisible();
    expect(await auditCount('game.nudge')).toBeGreaterThan(0);
  });

  test('legt ein Spiel an', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/anlegen');

    const date = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.getByLabel('Datum').fill(date);
    await page.getByLabel('Uhrzeit').fill('10:30');
    await page.getByLabel('Ort / Halle').fill('Testhalle');
    await page.getByLabel('Heim').fill(TESTMARKE);
    await page.getByLabel('Gast').fill('Gastverein');
    await page.getByRole('button', { name: /Anlegen/ }).click();

    await expect(formSuccess(page)).toContainText(/angelegt/);
    expect(await countGamesLike(`${TESTMARKE}%`)).toBe(1);
    expect(await auditCount('game.create')).toBeGreaterThan(0);
  });

  test('importiert eine CSV und legt beim zweiten Mal nichts doppelt an', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/anlegen?tab=csv');

    await page.getByLabel('CSV einfügen').fill(csvFor(50));
    await page.getByRole('button', { name: 'Importieren' }).click();
    await expect(formSuccess(page)).toContainText(/2 Spiele importiert/);
    expect(await countGamesLike(`${TESTMARKE}%`)).toBe(2);

    await page.goto('/anlegen?tab=csv');
    await page.getByLabel('CSV einfügen').fill(csvFor(50));
    await page.getByRole('button', { name: 'Importieren' }).click();
    await expect(formSuccess(page)).toContainText(/gibt es schon/);
    expect(await countGamesLike(`${TESTMARKE}%`)).toBe(2);
  });

  test('meldet eine unbrauchbare CSV, statt etwas anzulegen', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/anlegen?tab=csv');

    await page.getByLabel('CSV einfügen').fill('Datum;Zeit\n01.02.2026;10:00');
    await page.getByRole('button', { name: 'Importieren' }).click();
    await expect(formError(page)).toContainText(/Kopfzeile/);
    expect(await countGamesLike(`${TESTMARKE}%`)).toBe(0);
  });

  test('verschiebt ein Spiel und informiert Schiedsrichter und Ersatz', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await placeReferee(game, 2, SEED.lena.id);

    await loginAs(page, SEED.nele.phone);
    await page.goto(`/bearbeiten?spiel=${game}`);

    await expect(page.getByRole('heading', { name: 'Spiel bearbeiten', level: 1 })).toBeVisible();
    await page.getByLabel('Uhrzeit').fill('16:45');
    await page.getByRole('button', { name: /Speichern/ }).click();

    // Zwei Beteiligte: der Schiedsrichter und der Ersatz.
    await expect(formSuccess(page)).toContainText(/2 Beteiligte/);
  });

  test('entfernt jemanden aus einem Spiel und fragt den Ersatz', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await placeReferee(game, 2, SEED.lena.id);

    await loginAs(page, SEED.nele.phone);
    await page.goto(`/bearbeiten?spiel=${game}`);
    await page.getByRole('button', { name: 'Entfernen' }).first().click();

    await expect(formSuccess(page)).toContainText(/nachrückt/);
    expect(await auditCount('assignment.remove')).toBeGreaterThan(0);
  });

  test('gibt eine Frist für ein einzelnes Spiel frei', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';

    await loginAs(page, SEED.nele.phone);
    await page.goto(`/bearbeiten?spiel=${game}`);
    await page.getByLabel(/Austragen für dieses Spiel freigeben/).check();
    await page.getByRole('button', { name: /Speichern/ }).click();
    await expect(formSuccess(page)).toBeVisible();

    // Der Schiedsrichter kann sich jetzt austragen, obwohl die Frist abgelaufen ist.
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    await page.getByRole('button', { name: 'Eintragen' }).first().click();
    await expect(formSuccess(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Austragen' }).first()).toBeEnabled();
  });

  test('erteilt und entzieht eine Qualifikation', async ({ page }) => {
    await setQualificationDirect(SEED.jonas.id, 'Erwachsene', false);
    await loginAs(page, SEED.nele.phone);
    await page.goto('/schiris');

    await page
      .getByRole('button', { name: `Erwachsene für ${SEED.jonas.name} erteilen` })
      .click();
    await expect(formSuccess(page)).toContainText(/erteilt/);
    expect(await hasQualification(SEED.jonas.id, 'Erwachsene')).toBe(true);

    await page
      .getByRole('button', { name: `Erwachsene für ${SEED.jonas.name} entziehen` })
      .click();
    await expect(formSuccess(page)).toContainText(/entzogen/);
    expect(await hasQualification(SEED.jonas.id, 'Erwachsene')).toBe(false);
  });

  test('lehnt ein unbrauchbares Kürzel beim Anlegen ab', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/schiris');

    // Die Tabelle darüber enthält ebenfalls Felder mit diesen Beschriftungen —
    // gemeint sind die des Anlege-Formulars darunter.
    await page.getByLabel('Name', { exact: true }).fill('Test Person');
    await page.getByLabel('Kürzel', { exact: true }).fill('X');
    await page.getByLabel('Telefonnummer', { exact: true }).fill('0151 55500777');
    await page.getByRole('button', { name: /Schiedsrichter anlegen/ }).click();

    await expect(formError(page)).toContainText(/zwei bis vier Buchstaben/);
  });

  test('speichert Einstellungen und wirkt auf die Fristen', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/einstellungen');

    await page.getByLabel(/Austragen möglich bis/).fill('14');
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(formSuccess(page)).toContainText(/gespeichert/);
    expect(await withdrawDeadline()).toBe(14);
  });

  test('lässt einen unsinnigen Wert gar nicht erst abschicken', async ({ page }) => {
    // Der Browser blockt den Wert schon am Feld. Die serverseitige Prüfung
    // greift trotzdem — sie ist gegen einen umgangenen Browser gerichtet und
    // in den Integrationstests belegt.
    await loginAs(page, SEED.nele.phone);
    await page.goto('/einstellungen');

    const field = page.getByLabel(/Austragen möglich bis/);
    await field.fill('400');
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();

    expect(await field.evaluate((element: HTMLInputElement) => element.validity.valid)).toBe(false);
    expect(await withdrawDeadline()).toBe(21);
  });

  test('sagt, dass die Qualifikationsprüfung nicht abschaltbar ist', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/einstellungen');
    await expect(page.getByText(/lässt sich nicht abschalten/)).toBeVisible();
  });

  test('führt Spiele zum Nachpflegen auf', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    await page.goto('/nachpflegen');
    await expect(page.getByRole('heading', { name: /nachpflegen/, level: 1 })).toBeVisible();
    await expect(page.getByText(/für die Abrechnung maßgeblich/)).toBeVisible();
  });

  test('zeigt eine verschobene Partie im Schiedsrichter-Bereich als Rückfrage', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await markRelocated(game);

    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    await expect(page.getByText(/Spiel verschoben/)).toBeVisible();
  });

  test('keiner der Adminbildschirme scrollt waagerecht', async ({ page }) => {
    // Sechs Seitenaufbauten in einem Test — in dieser Umgebung dauert das.
    test.slow();
    await loginAs(page, SEED.nele.phone);
    for (const path of ['/uebersicht', '/meldungen', '/anlegen', '/schiris', '/einstellungen', '/nachpflegen']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
  });
});
