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
  '/uebersicht',
  '/meldungen',
  '/anlegen',
  '/schiris',
  '/nachrichten',
  '/einstellungen',
  '/regeln',
  '/impressum',
] as const;

export type KnownScreen = (typeof KNOWN_SCREENS)[number];

/**
 * Nach dem Login oeffnet sich zuerst der zuletzt benutzte Bildschirm.
 *
 * Beim ersten Mal haengt das Ziel an der Rolle. Ein Schiedsrichter beginnt bei
 * „Kalender & Verlauf“, so wie im Mockup beschrieben. Ein Admin beginnt bei der
 * Spieluebersicht, denn `/kalender` traegt die Navigation der Schiedsrichter —
 * er saehe dort keinen einzigen Weg in seinen eigenen Bereich und muesste die
 * Adresse von Hand eintippen, um ueberhaupt zu bemerken, dass er Admin ist.
 */
export const landingScreen = (
  lastScreen: string | null,
  role: 'referee' | 'admin' = 'referee',
): KnownScreen => {
  const match = KNOWN_SCREENS.find((screen) => screen === lastScreen);
  if (match) return match;
  return role === 'admin' ? '/uebersicht' : '/kalender';
};
