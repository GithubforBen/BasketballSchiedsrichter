import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-Tests gegen die laufende Anwendung.
 *
 * Zwei Geraeteklassen, weil die Oberflaeche eine responsive ist und nicht zwei
 * getrennte Layouts: dieselben Tests muessen am Schreibtisch und am Handy
 * bestehen.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

/**
 * In der Entwicklungsumgebung liegt bereits ein Chromium bereit, das nicht zur
 * hier gepinnten Playwright-Fassung passt. PLAYWRIGHT_CHROMIUM_PATH zeigt dann
 * darauf; in der CI laedt `playwright install` den passenden herunter und die
 * Angabe entfaellt.
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

/**
 * Der Browser im Test spricht ausschliesslich mit der Anwendung.
 *
 * `--no-proxy-server` haelt ihn von einem Proxy fern, den die Umgebung gesetzt
 * haben mag, und laesst externe Adressen sofort scheitern statt in eine
 * Zeitueberschreitung zu laufen. Das ist hier kein Detail: `modernist.css`
 * laedt Archivo von Google Fonts, und ohne diese Angabe wartet jeder
 * Seitenaufbau rund zwoelf Sekunden auf diese eine Anfrage, bevor `load`
 * ausgeloest wird — die eigene Seite ist nach 75 Millisekunden fertig. Die
 * Suite braucht damit ueber eine Stunde statt weniger Minuten. Fuer die Tests
 * aendert sich nichts: die Schrift ist Schmuck, und `display=swap` zeigt den
 * Text ohnehin sofort.
 */
const launchOptions = {
  launchOptions: {
    args: ['--no-proxy-server'],
    ...(chromiumPath ? { executablePath: chromiumPath } : {}),
  },
};

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/teardown.ts',
  /*
   * Grosszuegig bemessen: die Testumgebung braucht fuer einen Seitenaufbau
   * mehrere Sekunden, und ein Ablauf mit vier Aufrufen liefe sonst in die
   * Voreinstellung von 30 Sekunden.
   */
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], ...launchOptions } },
    { name: 'mobil', use: { ...devices['Pixel 7'], ...launchOptions } },
  ],
  // Laeuft schon ein Server unter E2E_BASE_URL, wird er benutzt; sonst startet
  // Playwright den Produktionsbuild selbst.
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          /*
           * Gegen genau das Artefakt, das auch im Container startet: der
           * eigenstaendige Server aus dem Build. So testet die E2E-Suite nicht
           * eine Variante, die es in Produktion gar nicht gibt.
           */
          command: 'npm run start:prepare && PORT=3100 npm run start',
          url: baseURL,
          /*
           * Der Server muss unter derselben Adresse von sich wissen, unter der
           * ihn der Test aufruft. Weiterleitungen werden gegen PUBLIC_BASE_URL
           * aufgeloest (siehe src/server/http.ts) — steht dort der Port aus der
           * Entwicklung, landet der Browser nach dem Abmelden auf einem Port,
           * auf dem nichts laeuft, und der Fehler sieht aus wie ein Fehler in
           * der Anwendung.
           */
          env: { PUBLIC_BASE_URL: baseURL },
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});
