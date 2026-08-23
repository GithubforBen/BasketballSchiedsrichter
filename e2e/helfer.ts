import { expect, type Page } from '@playwright/test';
import { latestLoginMessage, resetLoginState } from './db';

/**
 * Anmeldung als bestimmte Person — Aufbau für die Tests des angemeldeten
 * Bereichs. Der Weg entspricht dem echten: Zugang anfordern, Link aus der
 * Outbox holen, Link öffnen.
 */
export const loginAs = async (page: Page, phone: string): Promise<void> => {
  await resetLoginState();
  // Eine bestehende Sitzung würde die Anmeldeseite überspringen — ein Test,
  // der die Person wechselt, säße sonst weiter im alten Konto.
  await page.context().clearCookies();
  await page.goto('/anmelden');
  await page.getByLabel('Telefonnummer').fill(phone);
  await page.getByRole('button', { name: 'Zugang anfordern' }).click();
  await expect(page.locator('.form-success, p.form-error')).toBeVisible();
  const { link } = await latestLoginMessage();
  await page.goto(link);
};

/** Die Personen aus dem Seed, wie sie in den Tests gebraucht werden. */
export const SEED = {
  jonas: { id: 'r-jk', phone: '0151 23456789', name: 'Jonas Keller', initials: 'JK' },
  lena: { id: 'r-lb', phone: '0160 884210', name: 'Lena Brandt', initials: 'LB' },
  nele: { id: 'r-nb', phone: '0157 220671', name: 'Nele Baumann', initials: 'NB' },
} as const;

export const topbar = (page: Page) => page.locator('.shell-topbar');
export const formError = (page: Page) => page.locator('p.form-error');
export const formSuccess = (page: Page) => page.locator('p.form-success');
