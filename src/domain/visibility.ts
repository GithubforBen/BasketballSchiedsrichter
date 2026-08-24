import type { Referee } from './types';

/**
 * Sichtbarkeit personenbezogener Daten. Regeln 29-30.
 *
 * Ohne Login ist ausschliesslich das Kuerzel sichtbar. Entscheidend ist, dass
 * hier wirklich entfernt und nicht nur ausgeblendet wird: was diese Funktion
 * nicht zurueckgibt, darf auch nicht im ausgelieferten HTML oder JSON landen.
 */

export type Viewer =
  | { kind: 'anonymous' }
  | { kind: 'referee'; refereeId: string }
  | { kind: 'admin'; refereeId: string };

/** Was ein nicht angemeldeter Besucher von einer Person sehen darf. */
export interface PublicReferee {
  id: string;
  initials: string;
}

/** Was ein angemeldeter Nutzer sieht. */
export interface IdentifiedReferee extends PublicReferee {
  name: string;
}

export const canSeeIdentity = (viewer: Viewer): boolean => viewer.kind !== 'anonymous';

const toPublicReferee = (referee: Referee): PublicReferee => ({
  id: referee.id,
  initials: referee.initials,
});

const toIdentifiedReferee = (referee: Referee): IdentifiedReferee => ({
  id: referee.id,
  initials: referee.initials,
  name: referee.name,
});

/**
 * Der einzige Weg, eine Person in Richtung Oberflaeche zu geben.
 * Telefonnummer und Qualifikationen verlassen diese Ebene grundsaetzlich nicht.
 */
export const projectReferee = (
  referee: Referee,
  viewer: Viewer,
): PublicReferee | IdentifiedReferee =>
  canSeeIdentity(viewer) ? toIdentifiedReferee(referee) : toPublicReferee(referee);

/**
 * Felder, die laut Regel 30 ausschliesslich der Admin aendert.
 * Bleibt exportiert: die Liste ist die Regel in lesbarer Form, und aus ihr
 * folgt der Typ darunter — sie enger zu fassen verstecke beides.
 */
export const ADMIN_ONLY_FIELDS = ['name', 'initials', 'phone', 'qualifications'] as const;
export type RefereeField = (typeof ADMIN_ONLY_FIELDS)[number] | 'avatar';

/**
 * Regel 30: Name, Kuerzel, Telefonnummer und Qualifikationen aendert nur der
 * Admin. Das Profilbild aendert die Person selbst.
 */
export const canEditField = (field: RefereeField, viewer: Viewer, targetId: string): boolean => {
  if (viewer.kind === 'admin') return true;
  if (viewer.kind === 'anonymous') return false;
  return field === 'avatar' && viewer.refereeId === targetId;
};
