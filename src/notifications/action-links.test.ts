import { describe, expect, it } from 'vitest';
import { NOW, inDays, inHours, makeGame } from '@/domain/__fixtures__/build';
import {
  answerClaimsFor,
  answerLink,
  issueAnswerToken,
  readAnswerToken,
  type AnswerClaims,
} from './action-links';

/**
 * Der eindeutige Antwortlink.
 *
 * Die entscheidende Eigenschaft ist die Eindeutigkeit: aus dem Token muss
 * hervorgehen, welches Spiel, welche Person und welcher Vorgang gemeint sind —
 * und ein Token, der zu einer anderen Frage gehoert, darf diese hier nicht
 * beantworten.
 */

const SECRET = 'schluessel-nur-fuer-tests';

const claims = (over: Partial<AnswerClaims> = {}): AnswerClaims => ({
  kind: 'confirm',
  gameId: 'g1',
  refereeId: 'r-jk',
  reference: 'confirmation:g1:r-jk:initial',
  expiresAt: inDays(3),
  ...over,
});

describe('Ein Antwortlink benennt genau einen Vorgang', () => {
  it('gibt Spiel, Person und Vorgang unveraendert zurueck', () => {
    const check = readAnswerToken(issueAnswerToken(claims(), SECRET), SECRET, NOW);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.claims.kind).toBe('confirm');
    expect(check.claims.gameId).toBe('g1');
    expect(check.claims.refereeId).toBe('r-jk');
    expect(check.claims.reference).toBe('confirmation:g1:r-jk:initial');
  });

  it('ergibt fuer zwei Spiele zwei verschiedene Adressen', () => {
    const first = issueAnswerToken(claims({ gameId: 'g1' }), SECRET);
    const second = issueAnswerToken(claims({ gameId: 'g2' }), SECRET);
    expect(first).not.toBe(second);
  });

  it('unterscheidet die Nachfassnachricht von der ersten Bitte', () => {
    const initial = issueAnswerToken(claims({ reference: 'confirmation:g1:r-jk:initial' }), SECRET);
    const followUp = issueAnswerToken(
      claims({ reference: 'confirmation:g1:r-jk:follow-up' }),
      SECRET,
    );
    expect(initial).not.toBe(followUp);
  });

  it('haengt den Token ans Ende der Adresse — so verlangt es ein dynamischer URL-Knopf', () => {
    const token = issueAnswerToken(claims(), SECRET);
    expect(answerLink('https://schiriplan.test/', token)).toBe(
      `https://schiriplan.test/antwort/${token}`,
    );
  });
});

describe('Ein Antwortlink, der nicht stimmt, oeffnet nichts', () => {
  it('weist eine gefaelschte Signatur ab', () => {
    const token = issueAnswerToken(claims(), SECRET);
    const check = readAnswerToken(token, 'ein-anderer-schluessel', NOW);
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toBe('mismatch');
  });

  it('weist einen veraenderten Inhalt ab — die Signatur passt dann nicht mehr', () => {
    const token = issueAnswerToken(claims(), SECRET);
    const [payload, signature] = token.split('.');
    const other = Buffer.from(
      JSON.stringify({ k: 'confirm', g: 'g2', r: 'r-jk', n: 'x', e: 99999999999 }),
      'utf8',
    ).toString('base64url');
    expect(payload).not.toBe(other);
    const check = readAnswerToken(`${other}.${signature ?? ''}`, SECRET, NOW);
    expect(check.ok).toBe(false);
  });

  it('gilt nicht mehr, wenn der Anpfiff vorbei ist', () => {
    const token = issueAnswerToken(claims({ expiresAt: inHours(1) }), SECRET);
    const check = readAnswerToken(token, SECRET, inHours(2));
    expect(check.ok).toBe(false);
    if (check.ok) return;
    expect(check.reason).toBe('expired');
  });

  it('weist Bruchstuecke ab, statt daran zu zerbrechen', () => {
    for (const broken of ['', 'nur-ein-teil', '.', 'aa.bb']) {
      expect(readAnswerToken(broken, SECRET, NOW).ok).toBe(false);
    }
  });
});

describe('Welche Nachricht einen eindeutigen Link bekommt', () => {
  const source = {
    gameId: 'g1',
    refereeId: 'r-jk',
    key: 'confirmation:g1:r-jk:initial',
    payload: {},
    game: makeGame(),
  };

  it('gibt der Bitte um Bestaetigung einen — sie erwartet eine Antwort', () => {
    expect(answerClaimsFor('confirmation-request', source)?.kind).toBe('confirm');
    expect(answerClaimsFor('confirmation-follow-up', source)?.kind).toBe('confirm');
  });

  it('bindet die Nachrueck-Anfrage an ihre Id und nicht an das Spiel', () => {
    const found = answerClaimsFor('promotion-offer', {
      ...source,
      key: 'promotion:o-1',
      payload: { offerId: 'o-1' },
    });
    expect(found?.kind).toBe('promotion');
    expect(found?.reference).toBe('o-1');
  });

  it('laesst den Link mit dem Anpfiff ablaufen', () => {
    const kickoff = inDays(5);
    expect(answerClaimsFor('relocation', { ...source, game: makeGame({ kickoff }) })?.expiresAt)
      .toEqual(kickoff);
  });

  it('gibt Nachrichten ohne Rueckfrage keinen', () => {
    expect(answerClaimsFor('assignment', source)).toBeNull();
    expect(answerClaimsFor('personal-reminder', source)).toBeNull();
    expect(answerClaimsFor('open-slot-announcement', source)).toBeNull();
    expect(answerClaimsFor('daily-digest', source)).toBeNull();
  });

  it('gibt einem abgesagten Spiel keinen — dort ist nichts mehr zu entscheiden', () => {
    expect(
      answerClaimsFor('relocation', { ...source, game: makeGame({ state: 'cancelled' }) }),
    ).toBeNull();
  });
});
