import { describe, expect, it } from 'vitest';
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
});
