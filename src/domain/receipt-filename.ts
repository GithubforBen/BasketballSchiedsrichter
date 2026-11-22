import { calendarDay } from './time';

/** Dateiname der Einzelquittung: `quittung-<jjjj-mm-tt>-<heim>-<gast>.pdf`, nur ASCII. */

const MAX_TEAM_LENGTH = 40;

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_TEAM_LENGTH)
    .replace(/-+$/g, '');

export const receiptFilename = (
  game: { kickoff: Date; home: string; away: string },
  timeZone: string,
): string => {
  const parts = [calendarDay(game.kickoff, timeZone), slug(game.home), slug(game.away)];
  return `quittung-${parts.filter(Boolean).join('-')}.pdf`;
};
