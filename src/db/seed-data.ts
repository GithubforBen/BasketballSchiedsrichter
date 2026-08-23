import { INITIAL_LEAGUES } from '@/config/club';

/**
 * Die Daten aus dem Mockup, damit die Oberflaeche gegen dieselben Faelle
 * gebaut wird, die im Handoff zu sehen sind: ein verschobenes Spiel, ein leerer
 * Spieltag, ein voll besetztes Spiel und eine unvollstaendige Bestaetigung.
 *
 * Datum und Uhrzeit stehen in Ortszeit; `toKickoff` rechnet sie nach UTC.
 */

export const SEED_LEAGUES = INITIAL_LEAGUES;

export interface SeedReferee {
  id: string;
  name: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  qualifications: readonly string[];
  /** Einsaetze der laufenden Saison, fuer Statistik und Ranking. */
  seasonCount: number;
}

export const SEED_REFEREES: readonly SeedReferee[] = [
  {
    id: 'r-jk',
    name: 'Jonas Keller',
    initials: 'JK',
    phone: '+4915123456789',
    role: 'referee',
    qualifications: ['U14', 'U16', 'U18', 'Senioren'],
    seasonCount: 7,
  },
  {
    id: 'r-lb',
    name: 'Lena Brandt',
    initials: 'LB',
    phone: '+49160884210',
    role: 'referee',
    qualifications: ['U14', 'U16'],
    seasonCount: 8,
  },
  {
    id: 'r-tf',
    name: 'Timo Färber',
    initials: 'TF',
    phone: '+49171552903',
    role: 'referee',
    qualifications: ['U16', 'U18', 'Erwachsene', 'Senioren'],
    seasonCount: 11,
  },
  {
    id: 'r-ay',
    name: 'Aylin Yildiz',
    initials: 'AY',
    phone: '+49152337118',
    role: 'referee',
    qualifications: ['U14', 'U18'],
    seasonCount: 4,
  },
  {
    id: 'r-ms',
    name: 'Marco Silva',
    initials: 'MS',
    phone: '+49176908442',
    role: 'referee',
    qualifications: ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'],
    seasonCount: 9,
  },
  {
    id: 'r-nb',
    name: 'Nele Baumann',
    initials: 'NB',
    phone: '+49157220671',
    role: 'admin',
    qualifications: ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'],
    seasonCount: 12,
  },
];

export interface SeedGame {
  id: string;
  /** Ortszeit im Format `YYYY-MM-DDTHH:mm`. */
  kickoffLocal: string;
  leagueId: string;
  home: string;
  away: string;
  venue: string;
  /** Belegung der vier Plaetze, `null` fuer frei. */
  slots: readonly (string | null)[];
  /** Plaetze, deren Pflichtbestaetigung bereits vorliegt. */
  confirmed?: readonly number[];
  state?: 'scheduled' | 'moved';
}

export const SEED_GAMES: readonly SeedGame[] = [
  {
    id: 'g1',
    kickoffLocal: '2026-08-22T10:30',
    leagueId: 'U14',
    home: 'BG Nordstadt',
    away: 'TV Ostheim',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: ['r-lb', 'r-jk', null, null],
    state: 'moved',
  },
  {
    id: 'g2',
    kickoffLocal: '2026-08-22T13:00',
    leagueId: 'U16',
    home: 'BG Nordstadt II',
    away: 'SG Weiher',
    venue: 'Sporthalle Nordstadt, Feld 1',
    slots: [null, null, null, null],
  },
  {
    id: 'g3',
    kickoffLocal: '2026-08-23T15:00',
    leagueId: 'U18',
    home: 'BG Nordstadt',
    away: 'BBC Talheim',
    venue: 'Zeppelinhalle',
    slots: ['r-tf', null, 'r-ay', null],
  },
  {
    id: 'g4',
    kickoffLocal: '2026-08-29T11:00',
    leagueId: 'U14',
    home: 'SG Weiher',
    away: 'BG Nordstadt',
    venue: 'Halle am Weiher',
    slots: ['r-nb', 'r-ms', 'r-jk', 'r-lb'],
    confirmed: [0, 1],
  },
  {
    id: 'g5',
    kickoffLocal: '2026-08-29T14:00',
    leagueId: 'Erwachsene',
    home: 'BG Nordstadt',
    away: 'TSV Kirchheim',
    venue: 'Zeppelinhalle',
    slots: [null, null, null, null],
  },
  {
    id: 'g6',
    kickoffLocal: '2026-09-05T09:30',
    leagueId: 'Senioren',
    home: 'BG Nordstadt',
    away: 'TSG Aue',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: ['r-ms', null, null, null],
  },
  {
    id: 'g7',
    kickoffLocal: '2026-09-05T12:00',
    leagueId: 'U16',
    home: 'BG Nordstadt',
    away: 'SG Weiher',
    venue: 'Sporthalle Nordstadt, Feld 1',
    slots: ['r-tf', 'r-lb', 'r-jk', null],
  },
  {
    id: 'g8',
    kickoffLocal: '2026-09-12T10:30',
    leagueId: 'U14',
    home: 'BG Nordstadt',
    away: 'TV Ostheim',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: [null, null, null, null],
  },
];

/** Vergangene Einsaetze fuer Statistik und Verlauf. */
export const SEED_PAST_GAMES: readonly SeedGame[] = [
  {
    id: 'p1',
    kickoffLocal: '2026-08-15T10:00',
    leagueId: 'U14',
    home: 'BG Nordstadt',
    away: 'TSG Aue',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: ['r-jk', 'r-ms', null, null],
    confirmed: [0, 1],
  },
  {
    id: 'p2',
    kickoffLocal: '2026-08-09T14:30',
    leagueId: 'U18',
    home: 'BBC Talheim',
    away: 'BG Nordstadt',
    venue: 'Talheimer Halle',
    // Ersatz mit tatsaechlichem Einsatz — zaehlt fuer die Statistik. Regel 26.
    slots: ['r-tf', 'r-ms', 'r-jk', null],
    confirmed: [0, 1],
  },
  {
    id: 'p3',
    kickoffLocal: '2026-08-01T11:00',
    leagueId: 'U16',
    home: 'BG Nordstadt II',
    away: 'SG Weiher',
    venue: 'Sporthalle Nordstadt, Feld 1',
    // Ersatz ohne Einsatz — zaehlt nicht. Regel 26.
    slots: ['r-lb', 'r-nb', 'r-jk', null],
    confirmed: [0, 1],
  },
];

/** Ersatzplaetze, bei denen der Ersatz tatsaechlich gepfiffen hat. Regel 27. */
export const SEED_SUBSTITUTE_APPEARANCES: readonly { gameId: string; slotIndex: number }[] = [
  { gameId: 'p2', slotIndex: 2 },
];

/** Rechnet Ortszeit in einen UTC-Zeitstempel um. */
export const toKickoff = (local: string, timeZone: string): Date => {
  const naive = new Date(`${local}:00Z`);
  const offset = timeZoneOffsetMs(naive, timeZone);
  return new Date(naive.getTime() - offset);
};

const timeZoneOffsetMs = (date: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
};
