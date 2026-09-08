import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminShell, single } from '@/components/admin/AdminShell';
import { Note, Tag } from '@/components/primitives';
import { CLUB } from '@/config/club';
import { NOTIFICATION_KINDS } from '@/domain/notifications';
import { messageLogRoute } from '@/routes';
import { DEFAULT_RETENTION } from '@/server/aufbewahrung';
import { requireAdmin } from '@/server/guard';
import { isNotificationKindFilter, notificationLog } from '@/server/queries/protokoll';

/**
 * Das Nachrichten-Protokoll.
 *
 * Was rausgegangen ist, im Wortlaut — nicht nachgebaut, sondern so, wie es der
 * Empfaenger bekommen hat. Die Seite beantwortet zwei Fragen, die vorher
 * niemand beantworten konnte: "was habt ihr mir geschickt?" und "warum ist die
 * Nachricht nicht angekommen?".
 *
 * Sie steht unter Verwaltung und nicht unter Spielbetrieb: hier wird nichts
 * entschieden, hier wird nachgesehen.
 */

export const metadata: Metadata = { title: `Nachrichten · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Die Arten in der Sprache der Seite. */
const KIND_LABELS: Record<string, string> = {
  assignment: 'Einsatz steht',
  'confirmation-request': 'Bestätigung erbeten',
  'confirmation-follow-up': 'Bestätigung offen',
  'promotion-offer': 'Nachrücken',
  'open-slot-announcement': 'Platz frei',
  'admin-open-slots': 'Offene Plätze (Admin)',
  relocation: 'Termin geändert',
  'personal-reminder': 'Erinnerung',
  'admin-alert': 'Meldung (Admin)',
  'daily-digest': 'Tagesübersicht (Admin)',
  login: 'Anmeldung',
};

const kindLabel = (kind: string): string => KIND_LABELS[kind] ?? kind;

/** Datum und Uhrzeit in Vereinszeit, auf die Minute genau. */
const stamp = (at: Date): string =>
  at.toLocaleString('de-DE', {
    timeZone: CLUB.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const MessageLog = async ({ searchParams }: PageProps) => {
  const user = await requireAdmin();
  const params = await searchParams;

  const stateParam = single(params.zustand);
  const state = stateParam === 'sent' || stateParam === 'failed' ? stateParam : undefined;
  const kindParam = single(params.art);
  const kind = isNotificationKindFilter(kindParam) ? kindParam : undefined;
  const beforeParam = single(params.vor);
  /*
   * Ein unbrauchbarer Zeitpunkt in der Adresse fuehrt zur ersten Seite und
   * nicht zu einer Fehlerseite: die Adresse ist von aussen bearbeitbar, und
   * eine falsche Ziffer darin ist kein Grund, gar nichts zu zeigen.
   */
  const before = beforeParam ? new Date(beforeParam) : undefined;
  const validBefore = before && !Number.isNaN(before.getTime()) ? before : undefined;

  const { entries, nextBefore, counts } = await notificationLog({
    state,
    kind,
    before: validBefore,
  });

  /* Nur die Arten, die es hier wirklich gibt — ein leerer Filter hilft niemandem. */
  const usedKinds = NOTIFICATION_KINDS.filter((value) =>
    entries.some((entry) => entry.kind === value),
  );

  return (
    <AdminShell
      user={user}
      current="/nachrichten"
      kicker={`${counts.sent} zugestellt · ${counts.failed} gescheitert`}
      title="Nachrichten-Protokoll"
      lead={
        'Jede Nachricht im Wortlaut, wie sie rausgegangen ist. Der Text wird beim Versand ' +
        'festgehalten und nicht nachträglich neu erzeugt — ein später verlegtes Spiel ändert ' +
        `den Beleg also nicht. Einträge werden nach ${DEFAULT_RETENTION.outboxDays} Tagen gelöscht.`
      }
    >
      <div className="row log-filters" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <Link
          href={messageLogRoute({ kind })}
          className={`btn btn-compact ${state === undefined ? 'btn-primary' : 'btn-secondary'}`}
        >
          Alle
        </Link>
        <Link
          href={messageLogRoute({ state: 'sent', kind })}
          className={`btn btn-compact ${state === 'sent' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Zugestellt
        </Link>
        <Link
          href={messageLogRoute({ state: 'failed', kind })}
          className={`btn btn-compact ${state === 'failed' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Gescheitert
        </Link>

        {kind ? (
          <Link href={messageLogRoute({ state })} className="btn btn-ghost btn-compact">
            Art „{kindLabel(kind)}“ aufheben
          </Link>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <Note>
          {counts.sent + counts.failed === 0
            ? 'Noch nichts verschickt. Sobald eine Nachricht rausgeht, steht sie hier im Wortlaut.'
            : 'Zu diesem Filter gibt es keine Einträge.'}
        </Note>
      ) : (
        <ul className="card-list" style={{ maxWidth: '72ch' }}>
          {entries.map((entry) => (
            <li key={entry.id} className="outbox-entry">
              <div className="row" style={{ gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                <Tag tone={entry.state === 'failed' ? 'outline' : 'neutral'}>
                  {entry.state === 'failed' ? 'gescheitert' : 'zugestellt'}
                </Tag>
                <Tag tone="neutral">{entry.channel}</Tag>
                {/* Die Art als Link: ein Klick zeigt alle Nachrichten derselben Sorte. */}
                <Link
                  href={messageLogRoute({ state, kind: entry.kind })}
                  className="tag tag-neutral"
                >
                  {kindLabel(entry.kind)}
                </Link>
                <span className="text-muted" style={{ fontSize: '11px' }}>
                  an {entry.recipientName}
                </span>
                <span
                  className="text-muted log-stamp"
                  style={{ fontSize: '11px', marginLeft: 'auto' }}
                >
                  {stamp(entry.at)}
                </span>
              </div>

              {entry.subject ? <div className="outbox-subject">{entry.subject}</div> : null}

              {entry.body ? (
                <pre className="outbox-body">{entry.body}</pre>
              ) : (
                /*
                 * Zeilen von vor der Einfuehrung des Protokolls — und die zwei
                 * Faelle, die scheitern, bevor ein Text entsteht: die Person ist
                 * geloescht, oder die Art gibt es nicht mehr.
                 */
                <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-2)' }}>
                  Für diese Nachricht wurde kein Text festgehalten.
                </p>
              )}

              {entry.templateName ? (
                <details className="log-template">
                  <summary className="text-muted">
                    Vorlage <code>{entry.templateName}</code> · {entry.templateParameters.length}{' '}
                    {entry.templateParameters.length === 1 ? 'Wert' : 'Werte'}
                  </summary>
                  {/*
                    Die Werte einzeln und nummeriert: {{1}} ist der erste. Wird
                    eine Vorlage wegen der Zahl der Werte abgelehnt (Code 132000),
                    ist hier zu sehen, wie viele tatsaechlich mitgingen.
                  */}
                  <ol className="log-parameters">
                    {entry.templateParameters.map((value, index) => (
                      <li key={index}>
                        <code>{`{{${index + 1}}}`}</code> {value}
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}

              {entry.lastError ? (
                <div className="form-error" style={{ marginTop: 'var(--space-2)' }}>
                  {entry.lastError}
                  {entry.attempts > 1 ? ` · ${entry.attempts} Versuche` : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {/*
        Nachladen als Link und nicht als Knopf mit Javascript — wie im
        oeffentlichen Spielplan: der Zurueck-Knopf tut, was er soll.
      */}
      {nextBefore ? (
        <div className="load-more">
          <Link
            href={messageLogRoute({ state, kind, before: nextBefore })}
            className="btn btn-secondary"
          >
            Ältere Nachrichten
          </Link>
        </div>
      ) : null}

      {usedKinds.length > 1 && kind === undefined ? (
        <p className="text-muted" style={{ fontSize: '12px', marginTop: 'var(--space-4)' }}>
          Auf eine Art klicken, um nur diese zu sehen.
        </p>
      ) : null}
    </AdminShell>
  );
};

export default MessageLog;
