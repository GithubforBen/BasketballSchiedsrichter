import { afterEach, describe, expect, it, vi } from 'vitest';
import { PermanentSendError, channelsByName, isPermanent, toWhatsAppNumber } from './channel';
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
  it('adressiert die Cloud API mit Nummer, Text und Zugangsschluessel', async () => {
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
    expect(body['text']).toEqual({ preview_url: false, body: message.body });
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
