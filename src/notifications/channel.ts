import { env } from '@/server/env';
import type { RenderedMessage } from './templates';

/**
 * Der Versandweg.
 *
 * Die Anwendung kennt nur diese Schnittstelle. Welcher Kanal tatsaechlich
 * verwendet wird, entscheidet NOTIFICATION_CHANNEL — so laesst sich die
 * WhatsApp Cloud API einhaengen, ohne eine einzige Zeile Fachlogik anzufassen.
 */

export interface Recipient {
  refereeId: string;
  name: string;
  phone: string;
}

export interface OutgoingMessage extends RenderedMessage {
  kind: string;
  recipient: Recipient;
  /** Idempotenzschluessel. Derselbe Schluessel darf nur einmal rausgehen. */
  key: string;
}

export interface Channel {
  readonly name: 'dev' | 'email' | 'whatsapp';
  send(message: OutgoingMessage): Promise<void>;
}

/**
 * Ein Fehler, der sich durch Wiederholen nicht bessert.
 *
 * Eine falsche Telefonnummer oder ein abgelehnter Textbaustein bleiben auch
 * beim zehnten Versuch falsch. Jeder Versuch kostet Geld (Regel 33), deshalb
 * unterscheidet die Outbox diese Faelle und gibt sie sofort auf, statt sie
 * durch den Wiederholungsplan zu schleifen.
 */
export class PermanentSendError extends Error {
  readonly permanent = true;
  constructor(message: string) {
    super(message);
    this.name = 'PermanentSendError';
  }
}

export const isPermanent = (error: unknown): boolean =>
  error instanceof PermanentSendError ||
  (typeof error === 'object' && error !== null && 'permanent' in error && Boolean(
    (error as { permanent?: unknown }).permanent,
  ));

/**
 * In der Entwicklung geht nichts hinaus. Die Nachricht landet nur in der
 * Outbox und ist unter /dev/outbox lesbar — samt anklickbarem Anmeldelink.
 */
const devChannel: Channel = {
  name: 'dev',
  send: () => Promise.resolve(),
};

const emailChannel: Channel = {
  name: 'email',
  async send(message) {
    const url = process.env.SMTP_URL;
    if (!url) {
      throw new PermanentSendError(
        'SMTP_URL fehlt — ohne sie kann der E-Mail-Kanal nicht senden.',
      );
    }
    const { createTransport } = await import('nodemailer');
    await createTransport(url).sendMail({
      from: process.env.MAIL_FROM ?? 'schiriplan@example.org',
      /*
       * Der Uebergangskanal: solange die WhatsApp-Freigabe fehlt, gehen
       * Nachrichten an eine Adresse, die aus der Telefonnummer gebildet wird.
       * MAIL_TEST_RECIPIENT lenkt in der Erprobung alles auf ein Postfach um.
       */
      to: process.env.MAIL_TEST_RECIPIENT ?? `${message.recipient.phone}@example.invalid`,
      subject: message.subject,
      text: message.body,
    });
  },
};

/** Meta erwartet die Nummer ohne Pluszeichen und ohne Trennzeichen. */
export const toWhatsAppNumber = (phone: string): string => phone.replace(/[^\d]/g, '');

/**
 * Antwortet die Cloud API mit einem dieser Codes, hilft kein zweiter Versuch.
 *
 * 131026 "Nachricht nicht zustellbar" und 131047 stehen fuer Nummern ohne
 * WhatsApp beziehungsweise fuer ein abgelaufenes Antwortfenster; 132xxx meldet
 * abgelehnte oder unbekannte Vorlagen; 100 und 190 sind Konfigurationsfehler.
 * Alles andere — Zeitueberschreitungen, 5xx, Drosselung — ist voruebergehend.
 */
const PERMANENT_WHATSAPP_CODES = new Set([100, 190, 131008, 131026, 131047, 132000, 132001, 132007, 132012, 132015]);

interface CloudApiError {
  message?: unknown;
  code?: unknown;
  error_data?: { details?: unknown };
}

const describeCloudError = (status: number, body: unknown): Error => {
  const error =
    typeof body === 'object' && body !== null && 'error' in body
      ? ((body as { error?: CloudApiError }).error ?? {})
      : {};
  const code = typeof error.code === 'number' ? error.code : null;
  const detail =
    typeof error.error_data?.details === 'string'
      ? error.error_data.details
      : typeof error.message === 'string'
        ? error.message
        : `HTTP ${status}`;
  const text = `WhatsApp Cloud API: ${detail}${code === null ? '' : ` (Code ${code})`}`;

  /*
   * 4xx ohne bekannten Code ist ebenfalls dauerhaft: die Anfrage war falsch
   * gebaut, und dieselbe Anfrage bleibt falsch. Die Drosselung (429) ist die
   * Ausnahme, sie geht vorbei.
   */
  const permanent =
    (code !== null && PERMANENT_WHATSAPP_CODES.has(code)) ||
    (status >= 400 && status < 500 && status !== 429);

  return permanent ? new PermanentSendError(text) : new Error(text);
};

/**
 * Meta WhatsApp Cloud API.
 *
 * Verschickt wird eine freie Textnachricht. Das genuegt innerhalb des
 * 24-Stunden-Fensters nach einer Antwort des Nutzers; ausserhalb verlangt Meta
 * eine freigegebene Vorlage. Die Texte stehen deshalb geschlossen in
 * `templates.ts` und lassen sich dort eins zu eins als Vorlage einreichen,
 * ohne dass sich am Versandweg etwas aendert.
 */
const whatsappChannel: Channel = {
  name: 'whatsapp',
  async send(message) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !token) {
      throw new PermanentSendError(
        'WHATSAPP_PHONE_NUMBER_ID oder WHATSAPP_ACCESS_TOKEN fehlt. Siehe .env.example.',
      );
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toWhatsAppNumber(message.recipient.phone),
          type: 'text',
          text: { preview_url: false, body: message.body },
        }),
      },
    );

    if (!response.ok) {
      throw describeCloudError(response.status, await response.json().catch(() => null));
    }
  },
};

export const activeChannel = (): Channel => {
  switch (env.channel) {
    case 'dev':
      return devChannel;
    case 'email':
      return emailChannel;
    case 'whatsapp':
      return whatsappChannel;
  }
};

/** Nur fuer Tests: der Kanal, ohne den Umweg ueber die Umgebungsvariable. */
export const channelsByName = {
  dev: devChannel,
  email: emailChannel,
  whatsapp: whatsappChannel,
} as const;
