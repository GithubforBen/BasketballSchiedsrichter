import { afterEach, describe, expect, it } from 'vitest';
import { GET, POST } from './route';

/**
 * Der Zugang zum Cron-Endpunkt.
 *
 * Ein offener Endpunkt hiesse, dass jeder Fremde Nachrichten ausloesen kann —
 * und jede Nachricht kostet den Verein Geld (Regel 33). Geprueft wird deshalb
 * nur die Tuer; was dahinter passiert, hat seine eigenen Tests.
 */

const request = (auth?: string): Request =>
  new Request('https://schiriplan.test/api/cron', {
    method: 'POST',
    headers: auth === undefined ? {} : { authorization: auth },
  });

const before = process.env.CRON_SECRET;

afterEach(() => {
  if (before === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = before;
});

describe('Ohne gueltigen Schluessel passiert nichts', () => {
  it('weist eine Anfrage ohne Kopfzeile ab', async () => {
    process.env.CRON_SECRET = 'geheim-und-lang-genug';
    expect((await POST(request())).status).toBe(401);
  });

  it('weist einen falschen Schluessel ab', async () => {
    process.env.CRON_SECRET = 'geheim-und-lang-genug';
    expect((await POST(request('Bearer falsch'))).status).toBe(401);
  });

  it('weist ab, solange der Beispielwert steht', async () => {
    process.env.CRON_SECRET = 'bitte-ersetzen';
    expect((await POST(request('Bearer bitte-ersetzen'))).status).toBe(401);
  });

  it('weist ab, wenn gar kein Schluessel gesetzt ist — sonst waere die Tuer offen', async () => {
    delete process.env.CRON_SECRET;
    expect((await POST(request('Bearer egal'))).status).toBe(401);
  });

  it('schuetzt auch den Trockenlauf', async () => {
    process.env.CRON_SECRET = 'geheim-und-lang-genug';
    expect((await GET(request())).status).toBe(401);
  });

  it('verraet ueber die Antwort nicht, wie lang der Schluessel ist', async () => {
    process.env.CRON_SECRET = 'geheim-und-lang-genug';
    const kurz = await POST(request('Bearer g'));
    const lang = await POST(request('Bearer geheim-und-lang-genuh'));
    expect(kurz.status).toBe(401);
    expect(lang.status).toBe(401);
    expect(await kurz.json()).toEqual(await lang.json());
  });
});
