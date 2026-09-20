import { expect, test, type Page } from '@playwright/test';
import {
  answerLinkFor,
  createGame,
  dayKeyOfGame,
  dropGame,
  initialsOf,
  markRelocated,
  occupantsOf,
  pendingOfferFor,
  placeReferee,
  reminderCount,
  resetAssignments,
  setReminders,
  upcomingGameIds,
} from './db';
import {
  expectNoHorizontalScroll,
  formError,
  formSuccess,
  loginAs,
  SEED,
  topbar,
} from './helfer';

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
      /*
       * Nicht `getByRole('table')`: am Handy stehen die Spiele als Karten da
       * und die Tabelle ist ausgeblendet, also gar nicht erst im
       * Accessibility-Baum. Geprüft wird die Aussage, die für beide Layouts
       * gilt — die eigene Partie steht im Kalender.
       */
      await expect(page.locator('.calendar-grid')).toContainText('Testheim');
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
    for (const path of ['/spiele', '/kalender', '/profil', '/regeln', '/impressum']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
  });

  /*
   * Dasselbe noch einmal auf 320px.
   *
   * Das Handy-Profil dieser Suite ist ein Pixel 7 mit 412px — breit genug, dass
   * der Kalender dort durchging, waehrend er auf einem iPhone (320-430px) um bis
   * zu 336px hinauslief: das Raster hatte eine automatische Spalte, und die war
   * so breit wie die Tabelle darin. 320px ist die schmalste Breite, die noch
   * vorkommt, und sie deckt zugleich den Fall ab, dass jemand die Schrift
   * vergroessert.
   */
  test('auch auf 320px bleibt jeder Bildschirm im Bild', async ({ page }) => {
    test.slow();
    await loginAs(page, SEED.jonas.phone);
    await page.setViewportSize({ width: 320, height: 568 });
    for (const path of ['/spiele', '/kalender', '/profil', '/regeln', '/impressum']) {
      await page.goto(path);
      await expectNoHorizontalScroll(page, path);
    }
  });

  /*
   * Am Handy stehen die Spiele als Karten da, nicht als Tabelle. Der Umbruch
   * liegt bei 768px und steht in app.css (`.only-narrow`/`.only-wide`); hier
   * wird geprueft, dass beide Fassungen dieselben Spiele nennen — sonst faellt
   * eine von beiden irgendwann still hinten runter.
   */
  test('zeigt den Kalender am Handy als Karten und am Schreibtisch als Tabelle', async ({
    page,
    isMobile,
  }) => {
    await resetAssignments();
    await placeReferee((await upcomingGameIds())[0] ?? '', 0, SEED.jonas.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto('/kalender');

    const karten = page.locator('.calendar-grid .card-list.only-narrow');
    const tabelle = page.locator('.calendar-grid .only-wide table');

    if (isMobile) {
      await expect(karten.first()).toBeVisible();
      await expect(tabelle.first()).toBeHidden();
    } else {
      await expect(tabelle.first()).toBeVisible();
      await expect(karten.first()).toBeHidden();
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

test.describe('Der Antwortlink aus der Nachricht', () => {
  /*
   * Die Nachricht kommt aufs Telefon, und die Bestätigung soll nicht an einem
   * vergessenen Passwort scheitern — deshalb ohne Anmeldung. Geprüft wird das
   * Entscheidende: der Link trifft genau das Spiel, um das gebeten wurde, und
   * sagt beim zweiten Öffnen, dass genau dieses Spiel schon bestätigt ist.
   */
  test.beforeEach(async ({ page }) => {
    await resetAssignments();
    await page.context().clearCookies();
  });

  test('bestätigt genau dieses Spiel, ohne Anmeldung', async ({ page }) => {
    const [game] = await upcomingGameIds();
    await placeReferee(game ?? '', 0, SEED.jonas.id);
    const link = await answerLinkFor('confirm', game ?? '', SEED.jonas.id);

    await page.goto(link);
    await expect(
      page.getByRole('heading', { name: 'Bestätigst du deinen Einsatz?', level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Deine Bestätigung steht noch aus.')).toBeVisible();

    await page.getByRole('button', { name: /Ja, habe ich gelesen/ }).click();
    await expect(formSuccess(page)).toContainText(/Bestätigt/);

    // Zweiter Aufruf desselben Links: kein zweiter Knopf, sondern der Stand.
    await page.goto(link);
    await expect(page.getByText('Dieses Spiel hast du bereits bestätigt.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Ja, habe ich gelesen/ })).toHaveCount(0);
  });

  test('erklärt einen Link, der nicht gilt, statt ihn wirken zu lassen', async ({ page }) => {
    await page.goto('/antwort/kein-echter-token');
    await expect(
      page.getByRole('heading', { name: 'Dieser Link führt nicht weiter', level: 1 }),
    ).toBeVisible();
  });
});

test.describe('Regel 8 — das Spiel abgeben', () => {
  test.beforeEach(async () => {
    await resetAssignments();
  });

  /*
   * Auf einem Spieltag stehen mehrere Partien, und jede trägt einen Knopf
   * „Ersatz anfordern“. Gemeint ist immer die Karte, auf der man selbst
   * eingetragen ist — `.slot-mine` gibt es genau dort.
   */
  const eigeneKarte = (page: Page) =>
    page.locator('article.game').filter({ has: page.locator('.slot-mine') });

  /*
   * Der ganze Weg in einem Test, weil er als Ganzes gilt: Jonas gibt ab, Lena
   * sitzt auf der Bank und bekommt den Link, sie sagt zu — danach steht sie
   * auf seinem Platz und er ist raus.
   */
  test('fragt den Ersatz und tauscht bei einer Zusage die Plätze', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await placeReferee(game, 1, SEED.nele.id);
    await placeReferee(game, 2, SEED.lena.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);

    const knopf = eigeneKarte(page).getByRole('button', { name: 'Ersatz anfordern' });
    await expect(knopf).toBeEnabled();
    await knopf.click();
    await expect(formSuccess(page)).toBeVisible();

    const offer = await pendingOfferFor(game);
    expect(offer?.refereeId).toBe(SEED.lena.id);

    /* Bis zur Antwort bleibt alles, wie es war. */
    expect(await occupantsOf(game)).toEqual([
      `0:${SEED.jonas.id}`,
      `1:${SEED.nele.id}`,
      `2:${SEED.lena.id}`,
    ]);

    await page.context().clearCookies();
    await page.goto(await answerLinkFor('promotion', game, SEED.lena.id, offer?.id ?? ''));
    await page.getByRole('button', { name: 'Ja, ich übernehme' }).click();
    /*
     * Erst die Quittung abwarten, dann in die Datenbank sehen. Ohne diese
     * Zeile liest der Test den Stand, bevor die Server-Aktion ihn geschrieben
     * hat — und scheitert je nach Laufzeit mal so, mal so.
     */
    await expect(page.getByText(/nachgerückt|stehst jetzt/)).toBeVisible();

    expect(await occupantsOf(game)).toEqual([`0:${SEED.lena.id}`, `1:${SEED.nele.id}`]);
  });

  test('nimmt den Absagenden von der Bank und fragt den nächsten', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await placeReferee(game, 2, SEED.lena.id);
    await placeReferee(game, 3, SEED.nele.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);
    await eigeneKarte(page).getByRole('button', { name: 'Ersatz anfordern' }).click();
    await expect(formSuccess(page)).toBeVisible();

    const erste = await pendingOfferFor(game);
    expect(erste?.refereeId).toBe(SEED.lena.id);

    await page.context().clearCookies();
    await page.goto(await answerLinkFor('promotion', game, SEED.lena.id, erste?.id ?? ''));
    await page.getByRole('button', { name: 'Nein, ich kann nicht' }).click();
    await expect(page.getByText(/aus diesem Spiel raus/)).toBeVisible();

    /* Lena ist raus, Nele rückt von Ersatz 2 auf Ersatz 1 — und ist gefragt. */
    expect(await occupantsOf(game)).toEqual([`0:${SEED.jonas.id}`, `2:${SEED.nele.id}`]);
    const zweite = await pendingOfferFor(game);
    expect(zweite?.refereeId).toBe(SEED.nele.id);
    expect(zweite?.substituteSlot).toBe(2);
  });

  test('sperrt den Knopf ohne Ersatz und nennt den Grund', async ({ page }) => {
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);

    const karte = eigeneKarte(page);
    await expect(karte.getByRole('button', { name: 'Ersatz anfordern' })).toBeDisabled();
    await expect(karte.getByText(/kein Ersatz eingetragen/)).toBeVisible();
  });

  test('lädt niemanden mehr ein, sich zusätzlich als Ersatz einzutragen', async ({ page }) => {
    /*
     * Die alte Bedeutung des Knopfes: er schrieb den freien Ersatzplatz aus.
     * Sie ist weg, und der Hinweistext darf sie nicht mehr versprechen.
     */
    const game = (await upcomingGameIds())[0] ?? '';
    await placeReferee(game, 0, SEED.jonas.id);
    await placeReferee(game, 2, SEED.lena.id);

    await loginAs(page, SEED.jonas.phone);
    await page.goto(`/spiele?tag=${await dayKeyOfGame(game)}`);

    await expect(eigeneKarte(page).getByText(/Ersatz 1 wird gefragt/)).toBeVisible();
    await expect(page.getByText(/geht an alle mit Qualifikation/)).toHaveCount(0);
  });
});
