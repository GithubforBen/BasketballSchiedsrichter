import { expect, test } from '@playwright/test';
import {
  createGame,
  dayKeyOfGame,
  dropGame,
  initialsOf,
  markRelocated,
  placeReferee,
  reminderCount,
  resetAssignments,
  setReminders,
  upcomingGameIds,
} from './db';
import { formError, formSuccess, loginAs, SEED, topbar } from './helfer';

/**
 * Der Schiedsrichter-Bereich im Browser.
 *
 * Geprüft wird, was eine Person tatsächlich tun kann — und dass jede Sperre
 * ihren Grund nennt, statt einen Knopf stumm zu lassen.
 */

test.describe('Offene Spiele', () => {
  test.beforeEach(async () => {
    await resetAssignments();
  });

  test('zeigt einen Spieltag mit allen vier Plätzen', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    await expect(page.getByRole('heading', { name: 'Offene Spiele', level: 1 })).toBeVisible();
    for (const role of ['Schiri 1', 'Schiri 2', 'Ersatz 1', 'Ersatz 2']) {
      await expect(page.getByText(role, { exact: true }).first()).toBeVisible();
    }
  });

  test('trägt ein und zeigt die Eintragung danach an', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    await page.getByRole('button', { name: 'Eintragen' }).first().click();
    await expect(formSuccess(page)).toContainText(/Eingetragen/);
    await expect(page.getByText('du').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Austragen' }).first()).toBeVisible();
  });

  test('trägt wieder aus, solange die Frist läuft', async ({ page }) => {
    // Austragen geht nur bis 3 Wochen vor Anpfiff — das Spiel muss also weit
    // genug entfernt sein. Der Abstand der Seed-Spiele hängt vom heutigen Tag
    // ab, deshalb ein eigenes Spiel mit bekanntem Abstand.
    const game = 'e2e-weit';
    await createGame(game, 40);
    try {
      await loginAs(page, SEED.jonas.phone);
      await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);

      await page.getByRole('button', { name: 'Eintragen' }).first().click();
      await expect(formSuccess(page)).toContainText(/Eingetragen/);

      await page.getByRole('button', { name: 'Austragen' }).first().click();
      await expect(formSuccess(page)).toContainText(/Ausgetragen/);
    } finally {
      await dropGame(game);
    }
  });

  test('sperrt das Austragen kurz vor dem Anpfiff und nennt den Grund', async ({ page }) => {
    const game = 'e2e-nah';
    await createGame(game, 5);
    try {
      await loginAs(page, SEED.jonas.phone);
      await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);

      await page.getByRole('button', { name: 'Eintragen' }).first().click();
      await expect(formSuccess(page)).toContainText(/Eingetragen/);

      const withdrawButton = page.getByRole('button', { name: 'Austragen' }).first();
      await expect(withdrawButton).toBeDisabled();
      await expect(page.locator('.slot-mine .slot-reason')).toContainText(/Admin/);
    } finally {
      await dropGame(game);
    }
  });

  test('nennt bei jedem gesperrten Platz den Grund', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    // Ein Platz hinter dem nächsten freien ist noch nicht an der Reihe — und
    // sagt das auch.
    await expect(page.getByText(/Plätze werden der Reihe nach vergeben/).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'erst danach frei' }).first()).toBeDisabled();
    await expect(page.locator('.slot-reason').first()).not.toBeEmpty();
  });

  test('kein gesperrter Knopf bleibt ohne Erklärung', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    const rows = page.locator('.slot');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const disabled = row.locator('button:disabled');
      if ((await disabled.count()) === 0) continue;
      const label = (await disabled.first().innerText()).trim();
      if (label === 'belegt') continue;
      await expect(row.locator('.slot-reason'), `Zeile ${index} ohne Begründung`).not.toBeEmpty();
    }
  });

  test('wechselt den Spieltag über die Knöpfe und merkt ihn sich in der Adresse', async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    const first = await page.locator('.matchday-title').innerText();

    await page.getByRole('link', { name: /Nächster Tag/ }).click();
    await expect(page).toHaveURL(/tag=\d{4}-\d{2}-\d{2}/);
    await expect(page.locator('.matchday-title')).not.toHaveText(first);

    await page.getByRole('link', { name: /Vortag/ }).click();
    await expect(page.locator('.matchday-title')).toHaveText(first);
  });

  test('wechselt den Spieltag mit den Pfeiltasten', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    const first = await page.locator('.matchday-title').innerText();

    await page.getByRole('group', { name: 'Spieltag wechseln' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.matchday-title')).not.toHaveText(first);
  });

  test('am ersten Spieltag gibt es keinen Vortag — der Knopf sagt es', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    await expect(page.getByRole('button', { name: /Vortag/ })).toBeDisabled();
  });

  test('fragt nach einer Verschiebung nach und öffnet bei einer Absage den Platz', async ({
    page,
  }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await markRelocated(game);

    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    await expect(page.getByText(/Spiel verschoben/)).toBeVisible();
    await page.getByRole('button', { name: 'Absagen' }).click();
    await expect(formSuccess(page)).toContainText(/Abgesagt/);
    await expect(page.getByText(/Spiel verschoben/)).toHaveCount(0);
  });

  test('„Ich bleibe dabei“ lässt den Platz belegt und beendet die Nachfrage', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await markRelocated(game);

    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    await page.getByRole('button', { name: 'Ich bleibe dabei' }).click();

    await expect(formSuccess(page)).toContainText(/bleibst eingetragen/);
    await expect(page.getByText(/Spiel verschoben/)).toHaveCount(0);
  });

  test('zeigt fremde Belegungen als Kürzel', async ({ page }) => {
    const game = (await upcomingGameIds())[0];
    expect(game, 'kein kommendes Spiel im Seed').toBeDefined();
    await placeReferee(game ?? '', 0, SEED.lena.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');
    await expect(
      page.getByText(await initialsOf(SEED.lena.id), { exact: true }).first(),
    ).toBeVisible();
  });
});

test.describe('Kalender und Verlauf', () => {
  test.beforeEach(async () => {
    await resetAssignments();
  });

  test('öffnet sich nach dem Login zuerst', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await expect(page).toHaveURL(/\/kalender$/);
    await expect(page.getByRole('heading', { name: /Kalender/, level: 1 })).toBeVisible();
  });

  test('zeigt die eigenen kommenden Spiele', async ({ page }) => {
    const game = 'e2e-kalender';
    await createGame(game, 30);
    try {
      await placeReferee(game, 0, SEED.jonas.id);
      await loginAs(page, SEED.jonas.phone);
      await page.goto('/kalender');
      await expect(page.getByRole('table').first()).toContainText('Testheim');
    } finally {
      await dropGame(game);
    }
  });

  test('erklärt die Zählung und zeigt das Ranking anonym', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/kalender');

    await expect(page.getByText(/Ersatz ohne Einsatz zählt nicht/)).toBeVisible();
    await expect(page.locator('.ranking-me')).toContainText('Du');
    // Kein fremder Name im Ranking.
    for (const other of [SEED.lena.name, SEED.nele.name]) {
      await expect(page.locator('.ranking')).not.toContainText(other);
    }
  });
});

test.describe('Profil und Erinnerungen', () => {
  test.beforeEach(async () => {
    await resetAssignments();
    await setReminders(SEED.jonas.id, []);
  });

  test('zeigt Stammdaten nur zum Lesen', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/profil');

    await expect(page.getByText(SEED.jonas.name).first()).toBeVisible();
    await expect(page.getByText(/nur Admin/).first()).toBeVisible();
    // Kein Eingabefeld für Stammdaten.
    await expect(page.locator('input[name="name"], input[name="telefon"]')).toHaveCount(0);
  });

  test('setzt und entfernt eine Erinnerung', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/profil');

    await page.getByRole('button', { name: '3 Tage', exact: true }).click();
    await expect(formSuccess(page)).toContainText(/gesetzt/);
    expect(await reminderCount(SEED.jonas.id)).toBe(1);


    await page.getByRole('button', { name: 'Entfernen' }).first().click();
    await expect(formSuccess(page)).toContainText(/entfernt/);
    expect(await reminderCount(SEED.jonas.id)).toBe(0);
  });

  test('fragt ab der vierten Erinnerung nach den Kosten', async ({ page }) => {
    await setReminders(SEED.jonas.id, [168, 72, 48]);
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/profil');

    await page.getByRole('button', { name: '1 Tag', exact: true }).click();
    await expect(page.getByText(/kostet den Verein Geld/)).toBeVisible();
    // Ohne Zustimmung ist noch nichts gespeichert.
    expect(await reminderCount(SEED.jonas.id)).toBe(3);

    await page.getByRole('button', { name: 'Ja, hinzufügen' }).click();
    // Erst wenn die Rückfrage verschwunden ist, hat der Server geantwortet.
    await expect(page.getByText(/kostet den Verein Geld/)).toHaveCount(0);
    await expect(formSuccess(page)).toContainText(/gesetzt/);
    expect(await reminderCount(SEED.jonas.id)).toBe(4);
  });

  test('lässt die Kostenrückfrage abbrechen', async ({ page }) => {
    await setReminders(SEED.jonas.id, [168, 72, 48]);
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/profil');

    await page.getByRole('button', { name: '1 Tag', exact: true }).click();
    await page.getByRole('link', { name: 'Abbrechen' }).click();
    await expect(page.getByText(/kostet den Verein Geld/)).toHaveCount(0);
    expect(await reminderCount(SEED.jonas.id)).toBe(3);
  });

  test('sperrt bei zehn Erinnerungen und sagt warum', async ({ page }) => {
    await setReminders(SEED.jonas.id, [168, 120, 96, 72, 48, 36, 24, 12, 6, 3]);
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/profil');

    await expect(page.getByText('10 von 10 genutzt')).toBeVisible();
    await expect(page.getByRole('button', { name: /Limit von 10 erreicht/ })).toBeDisabled();

    await page.getByRole('button', { name: '1 Stunde', exact: true }).click();
    await expect(formError(page)).toContainText(/nicht möglich|Entferne/);
    expect(await reminderCount(SEED.jonas.id)).toBe(10);
  });
});

test.describe('Darstellung', () => {
  test('keiner der Bildschirme scrollt waagerecht', async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    for (const path of ['/spiele', '/kalender', '/profil']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} läuft ${overflow}px über`).toBeLessThanOrEqual(1);
    }
  });

  test('führt am Handy über die Tab-Leiste durch alle Bereiche', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'gilt nur für die Tab-Leiste am Handy');
    await loginAs(page, SEED.jonas.phone);
    await page.goto('/spiele');

    const tabbar = page.locator('.shell-tabbar');
    await expect(tabbar).toBeVisible();
    for (const label of ['Offene', 'Kalender', 'Profil', 'Regeln']) {
      await expect(tabbar.getByRole('link', { name: label })).toBeVisible();
    }
  });
});

test.describe('Zugangsschutz', () => {
  test('schickt nicht angemeldete Besucher zur Anmeldung', async ({ page }) => {
    for (const path of ['/spiele', '/kalender', '/profil']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/anmelden/);
    }
    await expect(topbar(page)).toContainText('nicht angemeldet');
  });
});
