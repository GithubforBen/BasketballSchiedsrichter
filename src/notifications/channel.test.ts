import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  PermanentSendError,
  channelsByName,
  isPermanent,
  toWhatsAppNumber,
  whatsappPayload,
} from './channel';
import type { OutgoingMessage } from './channel';

/**
 * Der WhatsApp-Kanal, ohne eine einzige echte Nachricht.
 *
 * Geprueft wird das, was Geld kostet oder es verbrennt: die Nummer im richtigen
 * Format, und die Unterscheidung zwischen einem Fehler, den ein zweiter Versuch
 * heilt, und einem, der bei jedem Versuch erneut abgerechnet wird.
 */

const message: OutgoingMessage = {
  kind: 'personal-reminder',
  key: 'reminder:g1:r-jk:24',
  subject: 'Erinnerung',
  body: 'Morgen um 10:30 Uhr.',
  template: {
    name: 'schiriplan_erinnerung',
    language: 'de',
    parameters: ['Jonas', '1 Tag', 'Sa 29.08.2026, 10:30 Uhr', 'Halle', 'in 22 Stunden'],
    buttonParameter: null,
  },
  recipient: { refereeId: 'r-jk', name: 'Jonas Keller', phone: '+49 151 23456789' },
};

const withEnv = async (vars: Record<string, string>, run: () => Promise<void>): Promise<void> => {
  const before = { ...process.env };
  Object.assign(process.env, vars);
  try {
    await run();
  } finally {
    process.env = before;
  }
};

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Die Telefonnummer im Format der Cloud API', () => {
  it('entfernt Pluszeichen und Leerzeichen', () => {
    expect(toWhatsAppNumber('+49 151 23456789')).toBe('4915123456789');
  });

  it('laesst eine bereits blanke Nummer unveraendert', () => {
    expect(toWhatsAppNumber('4915123456789')).toBe('4915123456789');
  });
});

describe('Der WhatsApp-Kanal schickt genau eine Anfrage', () => {
  it('adressiert die Cloud API mit Nummer, Vorlage und Zugangsschluessel', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await withEnv(
      { WHATSAPP_PHONE_NUMBER_ID: '12345', WHATSAPP_ACCESS_TOKEN: 'geheim' },
      async () => {
        await channelsByName.whatsapp.send(message);
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/12345/messages');
    expect((init.headers as Record<string, string>)['authorization']).toBe('Bearer geheim');
    const raw = init.body;
    expect(typeof raw).toBe('string');
    const body = JSON.parse(raw as string) as Record<string, unknown>;
    expect(body['to']).toBe('4915123456789');
    expect(body['type']).toBe('template');
    expect((body['template'] as { name: string }).name).toBe('schiriplan_erinnerung');
  });

  it('meldet fehlende Zugangsdaten als dauerhaft — Wiederholen hilft da nicht', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await withEnv({ WHATSAPP_PHONE_NUMBER_ID: '', WHATSAPP_ACCESS_TOKEN: '' }, async () => {
      await expect(channelsByName.whatsapp.send(message)).rejects.toBeInstanceOf(
        PermanentSendError,
      );
    });
  });
});

describe('Regel 33 — ein aussichtsloser Versuch wird nicht wiederholt', () => {
  const sendWithResponse = async (response: Response): Promise<unknown> => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    let caught: unknown = null;
    await withEnv(
      { WHATSAPP_PHONE_NUMBER_ID: '12345', WHATSAPP_ACCESS_TOKEN: 'geheim' },
      async () => {
        await channelsByName.whatsapp.send(message).catch((error: unknown) => {
          caught = error;
        });
      },
    );
    return caught;
  };

  it('gibt eine Nummer ohne WhatsApp sofort auf', async () => {
    const error = await sendWithResponse(
      jsonResponse(400, {
        error: { message: 'Receiver incapable', code: 131026 },
      }),
    );
    expect(isPermanent(error)).toBe(true);
  });

  it('gibt eine abgelehnte Vorlage sofort auf', async () => {
    const error = await sendWithResponse(
      jsonResponse(400, { error: { message: 'Template not found', code: 132001 } }),
    );
    expect(isPermanent(error)).toBe(true);
  });

  it('versucht es bei einem Serverfehler erneut', async () => {
    const error = await sendWithResponse(
      jsonResponse(500, { error: { message: 'Internal error', code: 2 } }),
    );
    expect(isPermanent(error)).toBe(false);
    expect(error).toBeInstanceOf(Error);
  });

  it('versucht es bei Drosselung erneut — sie geht vorbei', async () => {
    const error = await sendWithResponse(
      jsonResponse(429, { error: { message: 'Rate limit hit', code: 130429 } }),
    );
    expect(isPermanent(error)).toBe(false);
  });

  it('behandelt eine unverstaendliche 4xx-Antwort als dauerhaft', async () => {
    const error = await sendWithResponse(new Response('<html>Bad Request</html>', { status: 400 }));
    expect(isPermanent(error)).toBe(true);
  });

  it('nennt den Fehlercode im Text, damit er im Protokoll auffindbar ist', async () => {
    const error = await sendWithResponse(
      jsonResponse(400, { error: { message: 'Receiver incapable', code: 131026 } }),
    );
    expect(String(error)).toContain('131026');
  });
});

describe('Der Entwicklungskanal verschickt nichts', () => {
  it('gibt keine Anfrage nach draussen', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await channelsByName.dev.send(message);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Der Rumpf einer WhatsApp-Nachricht', () => {
  /*
   * Ausserhalb des 24-Stunden-Fensters nimmt Meta nur eine freigegebene Vorlage
   * an, und das Fenster steht bei einem Verein so gut wie nie offen. Was hier
   * gebaut wird, ist deshalb der Normalfall und nicht die Ausnahme.
   */
  it('schickt die Vorlage mit ihren Werten, nicht den Fliesstext', () => {
    const payload = whatsappPayload(message, '4915123456789') as {
      type: string;
      template: { name: string; language: { code: string }; components: readonly unknown[] };
    };
    expect(payload.type).toBe('template');
    expect(payload.template.name).toBe('schiriplan_erinnerung');
    expect(payload.template.language.code).toBe('de');
    expect(payload.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Jonas' },
          { type: 'text', text: '1 Tag' },
          { type: 'text', text: 'Sa 29.08.2026, 10:30 Uhr' },
          { type: 'text', text: 'Halle' },
          { type: 'text', text: 'in 22 Stunden' },
        ],
      },
    ]);
  });

  it('haengt den Antwort-Token als Knopfwert an, wo es einen gibt', () => {
    const payload = whatsappPayload(
      { ...message, template: { ...message.template!, buttonParameter: 'AAA.BBB' } },
      '4915123456789',
    ) as { template: { components: readonly Record<string, unknown>[] } };
    expect(payload.template.components[1]).toEqual({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: 'AAA.BBB' }],
    });
  });

  it('faellt ohne Vorlage auf den Fliesstext zurueck — der gilt nur im Fenster', () => {
    const payload = whatsappPayload({ ...message, template: null }, '4915123456789') as {
      type: string;
      text: { body: string };
    };
    expect(payload.type).toBe('text');
    expect(payload.text.body).toBe('Morgen um 10:30 Uhr.');
  });
});
