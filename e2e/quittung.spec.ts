import { expect, test, type Page } from "@playwright/test";
import { createGame, dropGame, placeReferee, resetAssignments } from "./db";
import {
  expectNoHorizontalScroll,
  formError,
  formSuccess,
  loginAs,
  SEED,
} from "./helfer";

/**
 * Fahrt, Kosten und Quittung im Browser, am Rechner und am Handy.
 *
 * Die Quittung ist ein PDF; geprueft wird die Antwort der Download-Route
 * (Typ, Dateiname, PDF-Kopf), nicht der Inhalt der Seiten. Der Inhalt hat
 * seine eigenen Tests bei der PDF-Erzeugung.
 */

const GAME = "e2e-quittung";
const PHONE = { width: 390, height: 844 } as const;

const setup = async (): Promise<void> => {
  await resetAssignments();
  await createGame(GAME, 7);
  await placeReferee(GAME, 0, SEED.jonas.id);
  await placeReferee(GAME, 1, SEED.lena.id);
};

const field = (page: Page, name: string) =>
  page.locator(`#kosten-${GAME}-${name}`);
const expenseDetails = (page: Page) =>
  page.locator("details", { has: field(page, "km") });
const saveButton = (page: Page) =>
  page
    .locator("form", { has: field(page, "km") })
    .getByRole("button", { name: "Speichern" });

/** Oeffnet "Fahrt & Kosten" des Testspiels im Kalender. */
const openExpenses = async (page: Page): Promise<void> => {
  await page.goto("/kalender");
  await expenseDetails(page).locator("summary").click();
  await expect(field(page, "km")).toBeVisible();
};

const fillAndSave = async (page: Page): Promise<void> => {
  await field(page, "fahrtart").selectOption("alone");
  await field(page, "km").fill("42");
  await field(page, "tagegeld").fill("10,50");
  await saveButton(page).click();
  await expect(formSuccess(page)).toContainText("Angaben gespeichert");
};

const receiptLink = (page: Page) =>
  expenseDetails(page)
    .locator("xpath=..")
    .getByRole("link", { name: "Quittung (PDF)" });

const receiptHref = async (page: Page): Promise<string> => {
  const href = await receiptLink(page).getAttribute("href");
  if (!href) throw new Error("Quittung (PDF) ohne Link");
  return href;
};

const expectPdf = async (page: Page, href: string): Promise<Buffer> => {
  const response = await page.request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect(response.headers()["content-disposition"]).toContain("quittung.pdf");
  const body = await response.body();
  expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  return body;
};

const askForEmptyPeriod = async (page: Page): Promise<void> => {
  await page.getByLabel("Von").fill("2000-01-01");
  await page.getByLabel("Bis").fill("2000-01-31");
  await page.getByRole("button", { name: "Quittungen (PDF)" }).click();
};

test.describe("Quittung am Rechner", () => {
  test.beforeEach(setup);
  test.afterEach(async () => {
    await dropGame(GAME);
  });

  // spec: schiri-quittung#referee-saves-travel-data
  test("speichert Fahrtdaten und zeigt sie beim erneuten Oeffnen wieder", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await openExpenses(page);
    await fillAndSave(page);

    await openExpenses(page);
    await expect(field(page, "fahrtart")).toHaveValue("alone");
    await expect(field(page, "km")).toHaveValue("42");
    await expect(field(page, "tagegeld")).toHaveValue("10,50");
  });

  test("lehnt Kilometer, die keine Zahl sind, mit einer Meldung ab", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await openExpenses(page);
    await field(page, "km").fill("viel");
    await saveButton(page).click();
    await expect(formError(page)).toContainText("Kilometer");
  });

  test("laedt die Quittung als PDF herunter", async ({ page }) => {
    await loginAs(page, SEED.jonas.phone);
    await openExpenses(page);
    await fillAndSave(page);
    await openExpenses(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      receiptLink(page).click(),
    ]);
    expect(download.suggestedFilename()).toBe("quittung.pdf");
  });

  // spec: schiri-quittung#either-referee-gets-the-same-receipt
  test("beide Schiedsrichter des Spiels bekommen dieselbe Quittung", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await openExpenses(page);
    const first = await expectPdf(page, await receiptHref(page));

    await loginAs(page, SEED.lena.phone);
    await openExpenses(page);
    const second = await expectPdf(page, await receiptHref(page));

    // Dieselben Namen und Betraege; bis auf die Metadaten gleich gross.
    expect(Math.abs(first.length - second.length)).toBeLessThan(64);
  });

  // spec: schiri-quittung#nothing-in-the-period
  test("zeigt bei leerem Zeitraum eine Meldung und erzeugt kein PDF", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto("/profil");
    await askForEmptyPeriod(page);

    await expect(page).toHaveURL(/\/profil/);
    await expect(formError(page)).toContainText("keine Spiele mit Quittung");
  });
});

test.describe("Quittung am Handy (390 x 844)", () => {
  test.use({ viewport: PHONE });
  test.beforeEach(setup);
  test.afterEach(async () => {
    await dropGame(GAME);
  });

  test("Kostenformular passt in die Breite, speichert, Quittung kommt als PDF", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await openExpenses(page);
    await expectNoHorizontalScroll(page, "/kalender (Fahrt & Kosten offen)");

    await fillAndSave(page);
    await openExpenses(page);
    await expectNoHorizontalScroll(page, "/kalender (nach dem Speichern)");
    await expect(field(page, "km")).toHaveValue("42");

    await expectPdf(page, await receiptHref(page));
  });

  test("das Profil mit den Sammel-Quittungen passt in die Breite", async ({
    page,
  }) => {
    await loginAs(page, SEED.jonas.phone);
    await page.goto("/profil");
    await expect(
      page.getByRole("heading", { name: "Quittungen für Zeitraum" }),
    ).toBeVisible();
    await expectNoHorizontalScroll(page, "/profil");

    await askForEmptyPeriod(page);
    await expect(formError(page)).toContainText("keine Spiele mit Quittung");
    await expectNoHorizontalScroll(page, "/profil (mit Meldung)");
  });
});
