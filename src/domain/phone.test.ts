import { describe, expect, it } from 'vitest';
import { formatPhone, maskPhone, normalisePhone } from './phone';

const ok = (input: string) => {
  const result = normalisePhone(input);
  expect(result.ok, `"${input}" wurde abgelehnt`).toBe(true);
  return result.ok ? result.phone : '';
};

describe('Regel 42 — jede übliche Schreibweise wird angenommen', () => {
  it('führt alle üblichen Schreibweisen derselben Nummer zusammen', () => {
    const variants = [
      '+4915123456789',
      '+49 151 23456789',
      '+49 (151) 23456789',
      '+49-151-23456789',
      '004915123456789',
      '0049 151 23456789',
      '0151 23456789',
      '0151/23456789',
      ' 0151 234 567 89 ',
    ];
    const results = new Set(variants.map(ok));
    expect(results).toEqual(new Set(['+4915123456789']));
  });

  it('lässt ausländische Nummern unangetastet', () => {
    expect(ok('+41 79 1234567')).toBe('+41791234567');
    expect(ok('+43 664 1234567')).toBe('+436641234567');
  });

  it('ergänzt die fehlende Null einer Mobilnummer', () => {
    // Wer die Nummer aus dem eigenen Handy abliest, hat dort keine Null stehen.
    expect(ok('151 23456789')).toBe('+4915123456789');
    expect(ok('15123456789')).toBe('+4915123456789');
  });

  it('erkennt die Landesvorwahl auch ohne Plus, wenn die Länge sie verrät', () => {
    expect(ok('4915123456789')).toBe('+4915123456789');
    // Kurz genug, um eine Ortsvorwahl ohne Null zu sein — Leer ist 0491.
    // Hier waere Raten eine andere Nummer, also wird gefragt.
    expect(normalisePhone('491234567').ok).toBe(false);
  });

  it('streicht die nationale Null hinter der Ländervorwahl, statt zu belehren', () => {
    // "+49 0151 …" ist der haeufigste Vertipper. Gemeint ist dieselbe Nummer;
    // eine Fehlermeldung hielte nur das Eintragen auf.
    expect(ok('+49 0151 23456789')).toBe('+4915123456789');
    expect(ok('0049 0151 23456789')).toBe('+4915123456789');
  });

  it('lehnt ab, was keine Nummer sein kann', () => {
    for (const input of ['', '   ', 'Telefon']) {
      expect(normalisePhone(input).ok, `"${input}" wurde angenommen`).toBe(false);
    }
  });

  it('rät nicht, wo Raten eine andere Nummer ergäbe', () => {
    // "41 79 …" ohne Plus: Schweiz oder deutsche Ortsvorwahl ohne Null? Eine
    // falsch geratene Nummer faellt niemandem auf — die Nachricht kommt nie an.
    const result = normalisePhone('41 79 1234567');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Vorwahl');
  });

  it('lehnt zu kurze und zu lange Nummern ab', () => {
    expect(normalisePhone('+49 12').ok).toBe(false);
    expect(normalisePhone('+49 1234567890123456').ok).toBe(false);
  });

  it('begründet jede Ablehnung', () => {
    const result = normalisePhone('Telefon');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
  });
});

describe('Regel 43 — angezeigt wird national mit Null', () => {
  it('macht aus der gespeicherten Form die, die jeder auf dem Handy sieht', () => {
    expect(formatPhone('+4915123456789')).toBe('0151 23456789');
    expect(formatPhone('+491761234567')).toBe('0176 1234567');
  });

  it('ergibt eine Schreibweise, die genau wieder auf dieselbe Nummer führt', () => {
    // Wer die angezeigte Nummer abschreibt und eintippt, muss beim selben
    // Datensatz landen — sonst waere die Anzeige eine Falle.
    for (const phone of ['+4915123456789', '+491761234567', '+4923112345678']) {
      expect(ok(formatPhone(phone))).toBe(phone);
    }
  });

  it('lässt ausländische Nummern international — die Null gilt dort nicht', () => {
    expect(formatPhone('+41791234567')).toBe('+41 791 234567');
  });

  it('gibt Unbekanntes unverändert zurück, statt es zu verstümmeln', () => {
    expect(formatPhone('unklar')).toBe('unklar');
  });

  it('verdeckt die Mitte, wenn nur bestätigt werden soll, wohin die Nachricht ging', () => {
    const masked = maskPhone('+4915123456789');
    expect(masked).toBe('0151 ••• ••89');
    expect(masked).not.toContain('23456');
  });
});
