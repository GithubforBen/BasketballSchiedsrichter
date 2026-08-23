import { env } from '@/server/env';
import type { RenderedMessage } from './templates';

/**
 * Der Versandweg.
 *
 * Die Anwendung kennt nur diese Schnittstelle. Welcher Kanal tatsaechlich
 * verwendet wird, entscheidet NOTIFICATION_CHANNEL — so laesst sich die
 * WhatsApp Cloud API spaeter einhaengen, ohne eine einzige Zeile Fachlogik
 * anzufassen.
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
      throw new Error('SMTP_URL fehlt — ohne sie kann der E-Mail-Kanal nicht senden.');
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

const whatsappChannel: Channel = {
  name: 'whatsapp',
  send() {
    // Wird in Meilenstein 5 an die Meta Cloud API angeschlossen. Bis dahin
    // faellt der Versuch auf, statt still ins Leere zu laufen.
    return Promise.reject(
      new Error('Der WhatsApp-Kanal ist noch nicht angeschlossen (Meilenstein 5).'),
    );
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
