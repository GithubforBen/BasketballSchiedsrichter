import { localToUtc } from '@/domain/time';
import type { License } from '@/domain/types';

/**
 * Die Daten aus dem Mockup, damit die Oberflaeche gegen dieselben Faelle
 * gebaut wird, die im Handoff zu sehen sind: ein verschobenes Spiel, ein leerer
 * Spieltag, ein voll besetztes Spiel und eine unvollstaendige Bestaetigung.
 *
 * Die Anpfiffzeiten sind **relativ zum heutigen Tag** angegeben und nicht als
 * feste Kalenderdaten. Mit festen Daten waere der Seed nach wenigen Wochen
 * wertlos: alle Spiele laegen in der Vergangenheit, und Fristen wie „Austragen
 * bis 3 Wochen vorher“ waeren gar nicht mehr erreichbar. Die Abstaende
 * entsprechen denen im Mockup — Anpfiff in 7, 8, 14, 21 und 28 Tagen.
 */

export interface SeedReferee {
  id: string;
  name: string;
  /** Anrede in jeder Nachricht. */
  firstName: string;
  initials: string;
  phone: string;
  role: 'referee' | 'admin';
  qualifications: readonly string[];
  /** Lizenz. `null` zeigt den Fall "kein Eintragen moeglich" im Beispiel. */
  license: License | null;
  /** Einsaetze der laufenden Saison, fuer Statistik und Ranking. */
  seasonCount: number;
}

export const SEED_REFEREES: readonly SeedReferee[] = [
  {
    id: 'r-jk',
    name: 'Jonas Keller',
    firstName: 'Jonas',
    initials: 'JK',
    phone: '+4915123456789',
    role: 'referee',
    qualifications: ['U14', 'U16', 'U18', 'Senioren'],
    license: 'D',
    seasonCount: 7,
  },
  {
    id: 'r-lb',
    name: 'Lena Brandt',
    firstName: 'Lena',
    initials: 'LB',
    phone: '+49160884210',
    role: 'referee',
    qualifications: ['U14', 'U16'],
    license: 'E',
    seasonCount: 8,
  },
  {
    id: 'r-tf',
    name: 'Timo Färber',
    firstName: 'Timo',
    initials: 'TF',
    phone: '+49171552903',
    role: 'referee',
    qualifications: ['U16', 'U18', 'Erwachsene', 'Senioren'],
    license: 'D',
    seasonCount: 11,
  },
  {
    id: 'r-ay',
    name: 'Aylin Yildiz',
    firstName: 'Aylin',
    initials: 'AY',
    phone: '+49152337118',
    role: 'referee',
    qualifications: ['U14', 'U18'],
    license: null,
    seasonCount: 4,
  },
  {
    id: 'r-ms',
    name: 'Marco Silva',
    firstName: 'Marco',
    initials: 'MS',
    phone: '+49176908442',
    role: 'referee',
    qualifications: ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'],
    license: 'D',
    seasonCount: 9,
  },
  {
    id: 'r-nb',
    name: 'Nele Baumann',
    firstName: 'Nele',
    initials: 'NB',
    phone: '+49157220671',
    role: 'admin',
    qualifications: ['U14', 'U16', 'U18', 'Erwachsene', 'Senioren'],
    license: 'D',
    seasonCount: 12,
  },
];

export interface SeedGame {
  id: string;
  /** Tage bis zum Anpfiff, gerechnet ab heute. Negativ heisst: vorbei. */
  daysAhead: number;
  /** Ortszeit im Format `HH:mm`. */
  time: string;
  leagueId: string;
  home: string;
  away: string;
  venue: string;
  /** Noetige Lizenz. Ohne Angabe die niedrigere. */
  requiredLicense?: License;
  /** Belegung der vier Plaetze, `null` fuer frei. */
  slots: readonly (string | null)[];
  /** Plaetze, deren Pflichtbestaetigung bereits vorliegt. */
  confirmed?: readonly number[];
  state?: 'scheduled' | 'moved';
}

export const SEED_GAMES: readonly SeedGame[] = [
  {
    id: 'g1',
    daysAhead: 7,
    time: '10:30',
    leagueId: 'U14',
    home: 'BG Nordstadt',
    away: 'TV Ostheim',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: ['r-lb', 'r-jk', null, null],
    state: 'moved',
  },
  {
    id: 'g2',
    daysAhead: 7,
    time: '13:00',
    leagueId: 'U16',
    home: 'BG Nordstadt II',
    away: 'SG Weiher',
    venue: 'Sporthalle Nordstadt, Feld 1',
    slots: [null, null, null, null],
  },
  {
    id: 'g3',
    daysAhead: 8,
    time: '15:00',
    leagueId: 'U18',
    home: 'BG Nordstadt',
    away: 'BBC Talheim',
    venue: 'Zeppelinhalle',
    slots: ['r-tf', null, 'r-ay', null],
  },
  {
    id: 'g4',
    daysAhead: 14,
    time: '11:00',
    leagueId: 'U14',
    home: 'SG Weiher',
    away: 'BG Nordstadt',
    venue: 'Halle am Weiher',
    slots: ['r-nb', 'r-ms', 'r-jk', 'r-lb'],
    confirmed: [0, 1],
  },
  {
    id: 'g5',
    daysAhead: 14,
    time: '14:00',
    leagueId: 'Erwachsene',
    home: 'BG Nordstadt',
    away: 'TSV Kirchheim',
    venue: 'Zeppelinhalle',
    requiredLicense: 'D',
    slots: [null, null, null, null],
  },
  {
    id: 'g6',
    daysAhead: 21,
    time: '09:30',
    leagueId: 'Senioren',
    home: 'BG Nordstadt',
    away: 'TSG Aue',
    venue: 'Sporthalle Nordstadt, Feld 2',
    requiredLicense: 'D',
    slots: ['r-ms', null, null, null],
  },
  {
    id: 'g7',
    daysAhead: 21,
    time: '12:00',
    leagueId: 'U16',
    home: 'BG Nordstadt',
    away: 'SG Weiher',
    venue: 'Sporthalle Nordstadt, Feld 1',
    slots: ['r-tf', 'r-lb', 'r-jk', null],
  },
  {
    id: 'g8',
    daysAhead: 28,
    time: '10:30',
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
    daysAhead: -8,
    time: '10:00',
    leagueId: 'U14',
    home: 'BG Nordstadt',
    away: 'TSG Aue',
    venue: 'Sporthalle Nordstadt, Feld 2',
    slots: ['r-jk', 'r-ms', null, null],
    confirmed: [0, 1],
  },
  {
    id: 'p2',
    daysAhead: -14,
    time: '14:30',
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
    daysAhead: -22,
    time: '11:00',
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

/**
 * Rechnet einen relativen Spieltag in einen Zeitstempel um.
 * `base` ist der Bezugstag, ueblicherweise heute.
 */
export const toKickoff = (
  game: Pick<SeedGame, 'daysAhead' | 'time'>,
  timeZone: string,
  base: Date = new Date(),
): Date => {
  const day = new Date(base.getTime() + game.daysAhead * 24 * 60 * 60 * 1000);
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(day);
  return localToUtc(`${localDate}T${game.time}`, timeZone);
};

/**
 * Weiterhin von hier aus erreichbar: die Seed-Daten und ihre Tests nutzen sie,
 * zu Hause ist sie aber in der Fachschicht.
 */
export { localToUtc };
