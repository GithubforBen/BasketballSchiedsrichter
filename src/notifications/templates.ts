import { CLUB } from '@/config/club';
import { TOKEN_LIFETIME_MINUTES } from '@/server/auth/tokens';

/**
 * Die Texte der ausgehenden Nachrichten.
 *
 * An einer Stelle gesammelt, weil sie beim Umstieg auf die WhatsApp Cloud API
 * als freigegebene Vorlagen hinterlegt werden muessen — dann aendert sich der
 * Versandweg, nicht der Wortlaut.
 */

export interface RenderedMessage {
  /** Betreff. WhatsApp kennt keinen, E-Mail schon. */
  subject: string;
  body: string;
}

export const loginMessage = (params: {
  name: string;
  link: string;
  code: string;
}): RenderedMessage => ({
  subject: `Anmeldung bei ${CLUB.appName}`,
  body: [
    `Hallo ${params.name},`,
    '',
    `hier ist dein Zugang zur Schiedsrichter-Planung der ${CLUB.name}:`,
    '',
    params.link,
    '',
    `Falls der Link nicht funktioniert, gib diesen Code ein: ${params.code}`,
    '',
    `Beides gilt ${TOKEN_LIFETIME_MINUTES} Minuten und nur ein einziges Mal.`,
    'Hast du dich nicht angemeldet? Dann ignoriere diese Nachricht einfach.',
  ].join('\n'),
});
