import { describe, expect, it, vi } from 'vitest';
import { clientIp } from './client-ip';

const headers = (entries: Record<string, string>) => new Headers(entries);

describe('IP des Besuchers hinter dem Cloudflare Tunnel', () => {
  it('nimmt den von Cloudflare gesetzten Kopf', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '203.0.113.7' }))).toBe('203.0.113.7');
  });

  it('bevorzugt Cloudflare gegenüber einem mitgeschickten X-Forwarded-For', () => {
    // Ein Angreifer kann X-Forwarded-For frei setzen; CF-Connecting-IP nicht,
    // weil Cloudflare ihn ueberschreibt.
    expect(
      clientIp(
        headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '10.0.0.1, 10.0.0.2' }),
      ),
    ).toBe('203.0.113.7');
  });

  it('faellt in der Entwicklung auf den ersten Eintrag der Kette zurück', () => {
    expect(clientIp(headers({ 'x-forwarded-for': '198.51.100.4, 10.0.0.2' }))).toBe('198.51.100.4');
  });

  it('liefert einen Platzhalter, wenn gar nichts da ist — nie einen leeren Schlüssel', () => {
    expect(clientIp(headers({}))).toBe('unbekannt');
    expect(clientIp(headers({ 'x-forwarded-for': '  ' }))).toBe('unbekannt');
  });

  /*
   * Der Wert wird als Schluessel in `rate_limits` geschrieben. Was keine
   * Adresse ist, darf dort nicht ankommen — sonst legte ein frei erfundener
   * Kopf je Anfrage eine neue Zeile an.
   */
  it('lehnt ab, was keine IP-Adresse ist', () => {
    for (const unfug of ['nicht-eine-ip', '999.999.999.999', 'localhost', '203.0.113.7 ; drop']) {
      expect(clientIp(headers({ 'cf-connecting-ip': unfug }))).toBe('unbekannt');
    }
  });

  it('nimmt auch eine IPv6-Adresse', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('traut X-Forwarded-For im Echtbetrieb nicht', () => {
    /*
     * Cloudflare haengt an diesen Kopf nur an, statt ihn zu ueberschreiben —
     * der erste Eintrag ist also frei waehlbar. Hinter dem Tunnel steht
     * ohnehin immer CF-Connecting-IP; ohne den ist im Echtbetrieb etwas faul,
     * und dann ist ein gemeinsamer Zaehler die sichere Antwort.
     */
    vi.stubEnv('NODE_ENV', 'production');
    try {
      expect(clientIp(headers({ 'x-forwarded-for': '198.51.100.4' }))).toBe('unbekannt');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
