/**
 * Wohin nach dem Login.
 *
 * Der zuletzt geoeffnete Bildschirm wird gemerkt und beim naechsten Mal wieder
 * geoeffnet. Akzeptiert wird er nur, wenn er zu einer bekannten Seite gehoert —
 * sonst waere die gespeicherte Zeichenkette ein offenes Weiterleitungsziel.
 *
 * Die Liste waechst mit den Bereichen aus Meilenstein 3 und 4.
 */

export const KNOWN_SCREENS = [
  '/',
  '/spiele',
  '/kalender',
  '/profil',
  '/regeln',
  '/impressum',
] as const;

export type KnownScreen = (typeof KNOWN_SCREENS)[number];

/**
 * Nach dem Login oeffnet sich zuerst der zuletzt benutzte Bildschirm; beim
 * ersten Mal „Kalender & Verlauf“, so wie im Mockup beschrieben.
 */
export const landingScreen = (lastScreen: string | null): KnownScreen => {
  const match = KNOWN_SCREENS.find((screen) => screen === lastScreen);
  return match ?? '/kalender';
};
