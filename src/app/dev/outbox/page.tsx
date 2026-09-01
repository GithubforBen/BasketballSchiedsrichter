import { desc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CLUB } from '@/config/club';
import { Note, Tag } from '@/components/primitives';
import { db, schema } from '@/db';
import { isNotificationKind } from '@/domain/notifications';
import { answerClaimsFor, issueAnswerToken } from '@/notifications/action-links';
import { salutationName } from '@/domain/license';
import { renderMessage } from '@/notifications/templates';
import { env } from '@/server/env';
import { toGame } from '@/server/queries/games';

/**
 * Die Outbox der Entwicklung.
 *
 * Im Kanal "dev" geht keine Nachricht hinaus — sie landet nur hier. Damit ist
 * die Anmeldung lokal vollstaendig durchspielbar, ohne WhatsApp oder ein
 * Postfach. Im Produktionsbetrieb ist die Seite nicht erreichbar.
 */
export const dynamic = 'force-dynamic';

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

  /*
   * Der Text entsteht mit derselben Funktion wie beim Versand. Was hier steht,
   * geht auch genau so raus — es gibt keinen zweiten Weg, auf dem ein anderer
   * Text entstehen koennte.
   */
  const now = new Date();
  const gameIds = [...new Set(rows.flatMap((row) => (row.gameId === null ? [] : [row.gameId])))];
  const gameRows =
    gameIds.length === 0
      ? []
      : await db.select().from(schema.games).where(inArray(schema.games.id, gameIds));
  const byGame = new Map(gameRows.map((row) => [row.id, toGame(row)]));

  /*
   * Auch in der Vorschau steht die Anrede, die tatsaechlich rausginge — der
   * Vorname. Sonst zeigte /dev/outbox einen anderen Text als den verschickten,
   * und die ganze Seite waere nichts mehr wert.
   */
  const names = await db
    .select({
      id: schema.referees.id,
      name: schema.referees.name,
      firstName: schema.referees.firstName,
    })
    .from(schema.referees);
  const byReferee = new Map(names.map((row) => [row.id, salutationName(row)]));

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
            const game = row.gameId === null ? null : (byGame.get(row.gameId) ?? null);
            /*
             * Auch der Antwortlink entsteht mit derselben Funktion wie beim
             * Versand — in der Vorschau ist er anklickbar und fuehrt genau
             * dorthin, wohin er beim Empfaenger fuehren wuerde.
             */
            const claims = isNotificationKind(row.kind)
              ? answerClaimsFor(row.kind, {
                  gameId: row.gameId,
                  refereeId: row.recipientId,
                  key: row.key,
                  payload: row.payload,
                  game,
                })
              : null;
            const rendered = isNotificationKind(row.kind)
              ? renderMessage(row.kind, {
                  recipientName: byReferee.get(row.recipientId) ?? row.recipientId,
                  game,
                  payload: row.payload,
                  baseUrl: env.baseUrl,
                  timeZone: CLUB.timeZone,
                  now,
                  answerToken: claims ? issueAnswerToken(claims, env.sessionSecret) : null,
                })
              : { subject: `Unbekannte Art: ${row.kind}`, body: '', template: null };
            return (
              <li key={row.id} className="outbox-entry">
                <div className="row" style={{ gap: 'var(--space-2)' }}>
                  <Tag tone={row.state === 'failed' ? 'outline' : 'neutral'}>{row.state}</Tag>
                  <Tag tone="neutral">{row.channel}</Tag>
                  <Tag tone="neutral">{row.kind}</Tag>
                  <span
                    className="text-muted"
                    style={{ fontSize: '11px', marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {row.sendAfter.toISOString()}
                  </span>
                </div>
                <div className="outbox-subject">{rendered.subject}</div>
                <pre className="outbox-body">{withLinks(rendered.body)}</pre>
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
