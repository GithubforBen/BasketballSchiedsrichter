import { expect, type Page } from '@playwright/test';
import { startPassword } from '@/domain/password';
import { resetLoginState } from './db';

/** Die Personen aus dem Seed, wie sie in den Tests gebraucht werden. */
export const SEED = {
  jonas: { id: 'r-jk', phone: '0151 23456789', name: 'Jonas Keller', initials: 'JK' },
  lena: { id: 'r-lb', phone: '0160 884210', name: 'Lena Brandt', initials: 'LB' },
  nele: { id: 'r-nb', phone: '0157 220671', name: 'Nele Baumann', initials: 'NB' },
} as const;

/**
 * Anmeldung als bestimmte Person — Aufbau für die Tests des angemeldeten
 * Bereichs. Der Weg entspricht dem echten: Telefonnummer und Passwort ins
 * Formular, absenden.
 *
 * Das Passwort steht nirgends: es folgt nach Regel 35 aus dem Namen, und der
 * Seed setzt genau das. Deshalb reicht hier die Nummer — der Rest ergibt sich.
 */
export const loginAs = async (page: Page, phone: string): Promise<void> => {
  const person = Object.values(SEED).find((entry) => entry.phone === phone);
  if (!person) throw new Error(`Keine Seed-Person mit der Nummer "${phone}"`);

  await resetLoginState();
  // Eine bestehende Sitzung würde die Anmeldeseite überspringen — ein Test,
  // der die Person wechselt, säße sonst weiter im alten Konto.
  await page.context().clearCookies();
  await page.goto('/anmelden');
  await page.getByLabel('Telefonnummer').fill(phone);
  await page.getByLabel('Passwort').fill(startPassword(person.name));
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('.shell-topbar')).toContainText(person.name);
};

export const topbar = (page: Page) => page.locator('.shell-topbar');
export const formError = (page: Page) => page.locator('p.form-error');
export const formSuccess = (page: Page) => page.locator('p.form-success');

/**
 * Prueft, dass die Seite nicht waagerecht scrollt — und sagt, woran es liegt.
 *
 * Die blosse Zahl ("laeuft 348px ueber") hilft beim Suchen nicht weiter. Wer
 * den Fehler behebt, will wissen, welches Element hinausragt; deshalb nennt
 * die Meldung die Uebeltaeter mitsamt ihrer Klasse und ihrem Text.
 */
export const expectNoHorizontalScroll = async (page: Page, path: string): Promise<void> => {
  const { over, culprits } = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;

    /*
     * Eine breite Tabelle in einem scrollbaren Rahmen ist kein Fehler — genau
     * dafuer gibt es den Rahmen. `getBoundingClientRect` meldet sie trotzdem in
     * voller Breite, weil sie das Layout-Rechteck liefert und nicht das
     * sichtbare. Gesucht sind deshalb nur Elemente, ueber denen kein Rahmen
     * steht, der waagerecht abschneidet.
     */
    const insideScroller = (element: Element): boolean => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        if (node === document.documentElement) return false;
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll' || overflowX === 'hidden') return true;
      }
      return false;
    };

    const culprits: string[] = [];
    for (const element of document.querySelectorAll('*')) {
      const box = element.getBoundingClientRect();
      if (box.right <= viewport + 1 && box.left >= -1) continue;
      if (insideScroller(element)) continue;
      const label = [
        element.tagName.toLowerCase(),
        element.className ? `.${String(element.className).trim().split(/\s+/).join('.')}` : '',
      ].join('');
      culprits.push(
        `${label} [${Math.round(box.left)}…${Math.round(box.right)}] ` +
          `"${(element.textContent ?? '').trim().slice(0, 40)}"`,
      );
    }
    return {
      over: document.documentElement.scrollWidth - viewport,
      culprits: culprits.slice(0, 6),
    };
  });

  expect(
    over,
    culprits.length === 0
      ? `${path} laeuft ${over}px ueber`
      : `${path} laeuft ${over}px ueber. Hinaus ragen:\n  ${culprits.join('\n  ')}`,
  ).toBeLessThanOrEqual(1);
};
