/**
 * Wohin nach dem Login.
 *
 * Der zuletzt geoeffnete Bildschirm wird gemerkt und beim naechsten Mal wieder
 * geoeffnet. Akzeptiert wird er nur, wenn er zu einer bekannten Seite gehoert —
 * sonst waere die gespeicherte Zeichenkette ein offenes Weiterleitungsziel.
 *
 * Die Liste waechst mit den Bereichen aus Meilenstein 3 und 4.
 */

export const KNOWN_SCREENS = ['/', '/regeln', '/impressum'] as const;

export type KnownScreen = (typeof KNOWN_SCREENS)[number];

export const landingScreen = (lastScreen: string | null): KnownScreen => {
  const match = KNOWN_SCREENS.find((screen) => screen === lastScreen);
  return match ?? '/';
};
