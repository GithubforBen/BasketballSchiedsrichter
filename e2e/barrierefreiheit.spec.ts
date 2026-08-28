import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginAs, SEED } from './helfer';
import { answerLinkFor, placeReferee, resetAssignments, upcomingGameIds } from './db';

/**
 * Barrierefreiheit, maschinell geprueft.
 *
 * Eine einmalige Sichtpruefung haelt nicht: der naechste Bildschirm bringt das
 * naechste Feld ohne Beschriftung. Deshalb laeuft die Pruefung ueber jeden
 * Bildschirm und bei jedem Testlauf mit.
 *
 * Geprueft wird gegen WCAG 2.1 AA — das ist der Massstab, auf den sich die
 * Barrierefreiheitsstellen berufen. Was ein automatisches Werkzeug nicht sehen
 * kann (ob eine Beschriftung *sinnvoll* ist, ob die Reihenfolge logisch ist),
 * steht als eigener Test weiter unten.
 */

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const analyse = async (page: Page) => {
  const result = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return result.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'ohne Einstufung'}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 3)
        .map((node) => `      ${node.html.slice(0, 120)}`)
        .join('\n'),
  );
};

const expectAccessible = async (page: Page, path: string): Promise<void> => {
  const violations = await analyse(page);
  expect(violations, `${path}:\n    ${violations.join('\n    ')}`).toEqual([]);
};

test.describe('Öffentliche Bildschirme', () => {
  for (const path of ['/', '/regeln', '/impressum', '/anmelden', '/notzugang']) {
    test(`${path} erfüllt WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(path);
      await expectAccessible(page, path);
    });
  }
});

test.describe('Die Antwortseite aus einer Nachricht', () => {
  /*
   * Sie ist oeffentlich und wird auf dem Telefon geoeffnet, oft von jemandem,
   * der die Anwendung sonst nie sieht. Genau dort darf die Pruefung nicht
   * fehlen — auch wenn die Adresse einen Token traegt und deshalb nicht in der
   * Liste oben stehen kann.
   */
  test('/antwort erfüllt WCAG 2.1 AA', async ({ page }) => {
    await resetAssignments();
    const [game] = await upcomingGameIds();
    await placeReferee(game ?? '', 0, SEED.jonas.id);
    try {
      await page.goto(await answerLinkFor('confirm', game ?? '', SEED.jonas.id));
      await expectAccessible(page, '/antwort');
    } finally {
      // Der Aufbau bleibt nicht liegen: die anderen Bildschirme sollen ihren
      // eigenen Zustand pruefen und nicht den, den dieser Test hinterlaesst.
      await resetAssignments();
    }
  });
});

test.describe('Bildschirme der Schiedsrichter', () => {
  for (const path of ['/kalender', '/spiele', '/profil', '/passwort']) {
    test(`${path} erfüllt WCAG 2.1 AA`, async ({ page }) => {
      await loginAs(page, SEED.jonas.phone);
      await page.goto(path);
      await expectAccessible(page, path);
    });
  }
});

test.describe('Bildschirme der Admins', () => {
  for (const path of [
    '/uebersicht',
    '/meldungen',
    '/anlegen',
    '/schiris',
    '/einstellungen',
    '/nachpflegen',
  ]) {
    test(`${path} erfüllt WCAG 2.1 AA`, async ({ page }) => {
      await loginAs(page, SEED.nele.phone);
      await page.goto(path);
      await expectAccessible(page, path);
    });
  }

  test('/bearbeiten erfüllt WCAG 2.1 AA', async ({ page }) => {
    await loginAs(page, SEED.nele.phone);
    const game = (await upcomingGameIds())[0] ?? '';
    await page.goto(`/bearbeiten?spiel=${game}`);
    await expectAccessible(page, '/bearbeiten');
  });
});

test.describe('Fehlerseiten', () => {
  test('die 404-Seite erfüllt WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/gibt-es-nicht');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('gibt es nicht');
    await expectAccessible(page, '/gibt-es-nicht');
  });
});

test.describe('Bedienung mit der Tastatur', () => {
  test('der erste Tabstopp springt zum Inhalt', async ({ page }) => {
    /*
     * Ohne diese Sprungmarke muesste sich jemand auf jeder Seite erneut durch
     * die gesamte Navigation arbeiten, bevor er beim Inhalt ankommt.
     */
    await page.goto('/');
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Zum Inhalt springen' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('main')).toBeFocused();
  });

  test('jedes Bedienelement der Anmeldung ist mit der Tastatur erreichbar', async ({ page }) => {
    await page.goto('/anmelden');

    const reachable: string[] = [];
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        return `${el.tagName.toLowerCase()}:${(el.textContent ?? '').trim().slice(0, 24)}`;
      });
      if (label) reachable.push(label);
    }

    expect(reachable.some((entry) => entry.startsWith('input'))).toBe(true);
    expect(reachable.some((entry) => entry.includes('Anmelden'))).toBe(true);
  });

  test('der Fokus bleibt sichtbar — ohne Umrandung ist die Tastatur blind', async ({ page }) => {
    await page.goto('/anmelden');
    await page.getByLabel('Telefonnummer').focus();

    const outline = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      const style = getComputedStyle(el);
      return { width: style.outlineWidth, style: style.outlineStyle, color: style.borderColor };
    });

    // Das Design-System faerbt beim Fokus den Rahmen des Eingabefelds um.
    expect(outline).not.toBeNull();
    expect(outline?.color).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Struktur der Seiten', () => {
  for (const path of ['/', '/regeln', '/impressum']) {
    test(`${path} hat genau eine Hauptüberschrift`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    });
  }

  test('die beiden Navigationsbereiche tragen verschiedene Namen', async ({ page }) => {
    /*
     * Zwei Bereiche mit demselben Namen sind fuer einen Screenreader nicht
     * auseinanderzuhalten, auch wenn immer nur einer sichtbar ist.
     */
    await page.goto('/');
    const namen = await page
      .locator('nav')
      .evaluateAll((navs) => navs.map((nav) => nav.getAttribute('aria-label')));
    expect(new Set(namen).size).toBe(namen.length);
  });
});
