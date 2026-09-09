import { expect, test } from '@playwright/test';
import { LEGAL, missingLegalFields } from '@/config/legal';

/**
 * Die zentrale Zusicherung aus Meilenstein 2: ohne Anmeldung verlaesst kein
 * Name und keine Telefonnummer den Server. Geprueft wird die ausgelieferte
 * Nutzlast, nicht nur das, was auf dem Bildschirm zu sehen ist.
 */

const NAMES = ['Jonas Keller', 'Lena Brandt', 'Timo Färber', 'Aylin Yildiz', 'Marco Silva', 'Nele Baumann'];
const SURNAMES = ['Keller', 'Brandt', 'Färber', 'Yildiz', 'Silva', 'Baumann'];

test.describe('Öffentliche Ansicht', () => {
  test('zeigt den Spielplan mit Kürzeln', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Spielplan', level: 1 })).toBeVisible();
    await expect(page.getByText(/Plätze besetzt/).first()).toBeVisible();
  });

  test('liefert ohne Anmeldung keinen Namen und keine Telefonnummer aus', async ({ page }) => {
    const response = await page.goto('/');
    const body = (await response?.text()) ?? '';
    expect(body.length).toBeGreaterThan(500);

    for (const name of [...NAMES, ...SURNAMES]) {
      expect(body, `"${name}" steht in der Auslieferung`).not.toContain(name);
    }
    // Auch keine Telefonnummer, in keiner Schreibweise.
    expect(body).not.toMatch(/\+49\s?\d{3}/);
  });

  test('nennt jeden Platz für Screenreader, auch die freien', async ({ page }) => {
    await page.goto('/');
    // Die Kürzel allein sagen einem Screenreader nichts — die Beschriftung schon.
    await expect(page.getByText(/^Schiedsrichter 1: /).first()).toBeAttached();
    await expect(page.getByText(/: frei$/).first()).toBeAttached();
  });

  test('erklärt die Statusfarben', async ({ page }) => {
    await page.goto('/');
    for (const label of ['besetzt', 'Ersatz fehlt', 'offen']) {
      await expect(page.getByRole('listitem').filter({ hasText: label }).first()).toBeVisible();
    }
  });

  test('führt zu Regeln und Impressum', async ({ page }) => {
    await page.goto('/regeln');
    await expect(page.getByRole('heading', { name: 'Regeln', level: 1 })).toBeVisible();
    await expect(page.getByText(/Wer zuerst einträgt, hat den Platz/)).toBeVisible();

    await page.goto('/impressum');
    await expect(page.getByRole('heading', { name: /Impressum/, level: 1 })).toBeVisible();
    /*
     * Hier stand: der Entwurfshinweis ist sichtbar. Den gibt es nicht mehr,
     * seit die Erklärung freigegeben ist (`reviewed` in src/config/legal.ts) —
     * ein Test, der ihn verlangt, hielte die Seite dauerhaft im Entwurf fest.
     *
     * Geprüft wird deshalb, was das Impressum tatsächlich leisten muss: die
     * Angaben nach § 5 DDG. Das ist die schärfere Prüfung — sie wäre auch bei
     * dem leeren Impressum angeschlagen, mit dem diese Seite lange lief.
     */
    expect(missingLegalFields()).toEqual([]);
    await expect(page.getByText(LEGAL.operator)).toBeVisible();
    await expect(page.getByText(/Vertreten durch:/)).toBeVisible();
  });

  test('scrollt nie waagerecht', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
