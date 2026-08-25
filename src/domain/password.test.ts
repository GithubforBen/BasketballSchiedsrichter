import { describe, expect, it } from 'vitest';
import { NOW, inDays } from './__fixtures__/build';
import {
  START_PASSWORD_VALID_DAYS,
  checkNewPassword,
  hasUsableStartPassword,
  mustChangePassword,
  passwordState,
  startPassword,
  startPasswordExpiry,
} from './password';

describe('Regel 35 — das Start-Passwort folgt aus dem Namen', () => {
  it('setzt Vor- und Nachnamen zusammen, alles klein', () => {
    expect(startPassword('Friedrich Merz')).toBe('friedrichmerz');
    expect(startPassword('Jonas Keller')).toBe('jonaskeller');
  });

  it('schreibt Umlaute aus — sonst waere es auf fremder Tastatur kaum tippbar', () => {
    expect(startPassword('Jörg Müller')).toBe('joergmueller');
    expect(startPassword('Anna-Lena Weiß')).toBe('annalenaweiss');
    expect(startPassword('Käthe Öztürk')).toBe('kaetheoeztuerk');
  });

  it('wirft alles weg, was kein Buchstabe ist', () => {
    expect(startPassword('Anna-Lena  Weiss')).toBe('annalenaweiss');
    expect(startPassword("Sean O'Brien")).toBe('seanobrien');
    expect(startPassword('Dr. Klaus Meier')).toBe('drklausmeier');
  });

  it('zerlegt fremde Akzente, statt den Buchstaben zu verlieren', () => {
    // Ohne Zerlegung bliebe von "José" nur "jos" übrig.
    expect(startPassword('José Álvarez')).toBe('josealvarez');
  });

  it('kommt auch mit einem einzelnen Namen zurecht', () => {
    expect(startPassword('Pelé')).toBe('pele');
  });

  it('erkennt einen Namen, aus dem sich nichts ableiten lässt', () => {
    expect(hasUsableStartPassword('Jonas Keller')).toBe(true);
    expect(hasUsableStartPassword('...')).toBe(false);
    expect(hasUsableStartPassword('')).toBe(false);
  });

  it('ergibt für denselben Namen immer dasselbe — sonst wäre es nicht nennbar', () => {
    expect(startPassword('Friedrich Merz')).toBe(startPassword('friedrich merz'));
  });
});

describe('Regel 36 — das Start-Passwort läuft ab', () => {
  it('gilt vierzehn Tage', () => {
    expect(START_PASSWORD_VALID_DAYS).toBe(14);
    expect(startPasswordExpiry(NOW).getTime()).toBe(inDays(14).getTime());
  });

  it('ist innerhalb der Frist gültig', () => {
    const status = { ownPasswordSetAt: null, startPasswordExpiresAt: inDays(14) };
    expect(passwordState(status, NOW)).toBe('start');
    expect(passwordState(status, inDays(13))).toBe('start');
  });

  it('ist nach der Frist wertlos', () => {
    const status = { ownPasswordSetAt: null, startPasswordExpiresAt: inDays(14) };
    expect(passwordState(status, inDays(15))).toBe('expired');
  });

  it('gilt bis zur letzten Sekunde und keine weiter', () => {
    const expiry = inDays(14);
    const status = { ownPasswordSetAt: null, startPasswordExpiresAt: expiry };
    expect(passwordState(status, new Date(expiry.getTime() - 1))).toBe('start');
    expect(passwordState(status, expiry)).toBe('expired');
  });

  it('gilt als abgelaufen, wenn gar keine Frist gesetzt ist', () => {
    // Ein Konto ohne eigenes Passwort und ohne Frist käme sonst nie weiter.
    const status = { ownPasswordSetAt: null, startPasswordExpiresAt: null };
    expect(passwordState(status, NOW)).toBe('expired');
  });
});

describe('Regel 37 — nach dem Start-Passwort muss ein eigenes gesetzt werden', () => {
  it('verlangt die Änderung, solange das Start-Passwort gilt', () => {
    expect(mustChangePassword({ ownPasswordSetAt: null, startPasswordExpiresAt: inDays(14) }, NOW)).toBe(
      true,
    );
  });

  it('verlangt sie nicht mehr, sobald ein eigenes Passwort steht', () => {
    const status = { ownPasswordSetAt: NOW, startPasswordExpiresAt: null };
    expect(passwordState(status, NOW)).toBe('own');
    expect(mustChangePassword(status, NOW)).toBe(false);
  });

  it('verlangt sie auch nicht bei einem abgelaufenen Start-Passwort — da kommt niemand rein', () => {
    const status = { ownPasswordSetAt: null, startPasswordExpiresAt: inDays(-1) };
    expect(mustChangePassword(status, NOW)).toBe(false);
  });
});

describe('Regel 38 — beim eigenen Passwort gelten keine Zeichenregeln', () => {
  it('nimmt kurze und einfache Passwörter an — so entschieden', () => {
    expect(checkNewPassword('abc', 'abc', false).ok).toBe(true);
    expect(checkNewPassword('1', '1', false).ok).toBe(true);
    expect(checkNewPassword('ball', 'ball', false).ok).toBe(true);
  });

  it('nimmt Leerzeichen und Sonderzeichen unverändert an', () => {
    const result = checkNewPassword('mein hund heißt bello', 'mein hund heißt bello', false);
    expect(result.ok).toBe(true);
    expect(result.ok && result.password).toBe('mein hund heißt bello');
  });

  it('lehnt ein leeres Passwort ab — das wäre keines', () => {
    const result = checkNewPassword('', '', false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('Bitte gib ein Passwort ein');
  });

  it('lehnt ab, wenn die Wiederholung nicht stimmt', () => {
    const result = checkNewPassword('sommer', 'somer', false);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('nicht gleich');
  });

  it('lehnt das bisherige Passwort ab — sonst wäre der Zwang folgenlos', () => {
    const result = checkNewPassword('jonaskeller', 'jonaskeller', true);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('bisheriges Passwort');
  });
});
