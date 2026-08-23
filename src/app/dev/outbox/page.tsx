import { desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Note, Tag } from '@/components/primitives';
import { db, schema } from '@/db';

/**
 * Die Outbox der Entwicklung.
 *
 * Im Kanal "dev" geht keine Nachricht hinaus — sie landet nur hier. Damit ist
 * die Anmeldung lokal vollstaendig durchspielbar, ohne WhatsApp oder ein
 * Postfach. Im Produktionsbetrieb ist die Seite nicht erreichbar.
 */
export const dynamic = 'force-dynamic';

interface Payload {
  subject?: unknown;
  body?: unknown;
}

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Macht den Anmeldelink in der Vorschau anklickbar. */
const withLinks = (body: string) =>
  body.split(/(\bhttps?:\/\/\S+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part}>
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );

const Outbox = async () => {
  if (process.env.NODE_ENV === 'production') notFound();

  const rows = await db
    .select()
    .from(schema.notificationOutbox)
    .orderBy(desc(schema.notificationOutbox.sendAfter))
    .limit(50);

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div className="kicker kicker-accent">Nur Entwicklung</div>
      <h1>Outbox</h1>
      <p className="text-muted" style={{ maxWidth: '58ch' }}>
        Alles, was die Anwendung verschicken würde. Im Kanal <code>dev</code> bleibt es hier
        stehen — der Anmeldelink ist anklickbar.
      </p>

      {rows.length === 0 ? (
        <Note>Noch nichts verschickt.</Note>
      ) : (
        <ul className="card-list" style={{ maxWidth: '68ch' }}>
          {rows.map((row) => {
            const payload = row.payload as Payload;
            return (
              <li key={row.id} className="outbox-entry">
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Tag tone={row.state === 'failed' ? 'outline' : 'neutral'}>{row.state}</Tag>
                  <Tag tone="neutral">{row.channel}</Tag>
                  <span
                    className="text-muted"
                    style={{ fontSize: '11px', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {row.sendAfter.toISOString()}
                  </span>
                </div>
                <div className="outbox-subject">{asText(payload.subject)}</div>
                <pre className="outbox-body">{withLinks(asText(payload.body))}</pre>
                {row.lastError ? (
                  <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>
                    {row.lastError}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Outbox;
