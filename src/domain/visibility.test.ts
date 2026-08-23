import { describe, expect, it } from 'vitest';
import { makeReferee } from './__fixtures__/build';
import { canEditField, canSeeIdentity, projectReferee, type Viewer } from './visibility';

const referee = makeReferee();
const anonymous: Viewer = { kind: 'anonymous' };
const self: Viewer = { kind: 'referee', refereeId: referee.id };
const other: Viewer = { kind: 'referee', refereeId: 'r-lb' };
const admin: Viewer = { kind: 'admin', refereeId: 'r-nb' };

describe('Regel 29 — ohne Login ist nur das Kuerzel sichtbar', () => {
  it('gibt ohne Login ausschliesslich Kuerzel und Id heraus', () => {
    expect(projectReferee(referee, anonymous)).toEqual({ id: 'r-jk', initials: 'JK' });
  });

  it('entfernt Name und Telefonnummer wirklich, statt sie nur auszublenden', () => {
    const serialised = JSON.stringify(projectReferee(referee, anonymous));
    expect(serialised).not.toContain(referee.name);
    expect(serialised).not.toContain(referee.phone);
    expect(serialised).not.toContain('Keller');
  });

  it('gibt auch angemeldet niemals die Telefonnummer oder Qualifikationen weiter', () => {
    for (const viewer of [self, other, admin]) {
      const serialised = JSON.stringify(projectReferee(referee, viewer));
      expect(serialised).not.toContain(referee.phone);
      expect(serialised).not.toContain('qualifications');
    }
  });

  it('zeigt den Namen nach dem Login', () => {
    expect(projectReferee(referee, self)).toMatchObject({ name: 'Jonas Keller' });
    expect(projectReferee(referee, other)).toMatchObject({ name: 'Jonas Keller' });
  });

  it('unterscheidet angemeldet von nicht angemeldet', () => {
    expect(canSeeIdentity(anonymous)).toBe(false);
    expect(canSeeIdentity(self)).toBe(true);
    expect(canSeeIdentity(admin)).toBe(true);
  });
});

describe('Regel 30 — Stammdaten aendert nur der Admin, das Profilbild die Person selbst', () => {
  it('sperrt Name, Kuerzel, Telefon und Qualifikationen fuer die Person selbst', () => {
    for (const field of ['name', 'initials', 'phone', 'qualifications'] as const) {
      expect(canEditField(field, self, referee.id)).toBe(false);
    }
  });

  it('erlaubt der Person ihr eigenes Profilbild', () => {
    expect(canEditField('avatar', self, referee.id)).toBe(true);
  });

  it('erlaubt niemandem das Profilbild eines anderen — ausser dem Admin', () => {
    expect(canEditField('avatar', other, referee.id)).toBe(false);
    expect(canEditField('avatar', admin, referee.id)).toBe(true);
  });

  it('erlaubt dem Admin alle Felder', () => {
    for (const field of ['name', 'initials', 'phone', 'qualifications', 'avatar'] as const) {
      expect(canEditField(field, admin, referee.id)).toBe(true);
    }
  });

  it('erlaubt ohne Login gar nichts', () => {
    for (const field of ['name', 'initials', 'phone', 'qualifications', 'avatar'] as const) {
      expect(canEditField(field, anonymous, referee.id)).toBe(false);
    }
  });
});
