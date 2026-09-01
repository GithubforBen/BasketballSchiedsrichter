import { buildSlots } from '../slots';
import {
  DEFAULT_SETTINGS,
  type Assignment,
  type ClubSettings,
  type Game,
  type Referee,
  type Slot,
  type SlotIndex,
} from '../types';

export const TIME_ZONE = 'Europe/Berlin';

/** Fester Bezugspunkt, damit Tests nicht von der echten Uhr abhaengen. */
export const NOW = new Date('2026-08-01T12:00:00Z');

export const at = (iso: string): Date => new Date(iso);

/** `NOW` plus so viele Tage/Stunden — macht Fristen in Tests lesbar. */
export const inDays = (n: number, from: Date = NOW): Date =>
  new Date(from.getTime() + n * 24 * 60 * 60 * 1000);
export const inHours = (n: number, from: Date = NOW): Date =>
  new Date(from.getTime() + n * 60 * 60 * 1000);

export const league = 'U14';

export const makeReferee = (overrides: Partial<Referee> = {}): Referee => ({
  id: 'r-jk',
  name: 'Jonas Keller',
  firstName: 'Jonas',
  initials: 'JK',
  phone: '+49 151 23456789',
  role: 'referee',
  qualifications: ['U14', 'U16', 'U18', 'Senioren'],
  license: 'D',
  reminderHours: [],
  digestWeeks: 4,
  digestEnabled: true,
  active: true,
  ...overrides,
});

export const makeGame = (overrides: Partial<Game> = {}): Game => ({
  id: 'g1',
  kickoff: inDays(30),
  leagueId: league,
  home: 'BG Nordstadt',
  away: 'TV Ostheim',
  venue: 'Sporthalle Nordstadt, Feld 2',
  requiredLicense: 'E',
  state: 'scheduled',
  vacancyVersion: 0,
  overrides: { withdraw: false, substituteRequest: false, oneGamePerDay: false },
  ...overrides,
});

export const makeAssignment = (
  slotIndex: SlotIndex,
  refereeId: string,
  overrides: Partial<Assignment> = {},
): Assignment => ({
  gameId: 'g1',
  slotIndex,
  refereeId,
  claimedAt: new Date(NOW.getTime() - 90 * 24 * 60 * 60 * 1000),
  confirmedAt: null,
  playedAsReferee: null,
  ...overrides,
});

/**
 * Baut die Plaetze eines Spiels aus einer Kurzschreibweise:
 * `slotsFrom(['r-lb', 'r-jk', null, null])` besetzt Schiri 1 und Schiri 2.
 */
export const slotsFrom = (
  occupants: readonly (string | null)[],
  tweak: (a: Assignment) => Assignment = (a) => a,
): readonly Slot[] =>
  buildSlots(
    occupants.flatMap((refereeId, index) =>
      refereeId === null ? [] : [tweak(makeAssignment(index as SlotIndex, refereeId))],
    ),
  );

export const settings = (overrides: Partial<ClubSettings> = {}): ClubSettings => ({
  ...DEFAULT_SETTINGS,
  ...overrides,
});
