import 'server-only';
import { asc, desc, eq } from 'drizzle-orm';
import { CLUB } from '@/config/club';
import { db, schema } from '@/db';
import { matchdayLabel, timeLabel } from '@/domain/schedule';
import { SLOT_LABELS } from '@/domain/slots';
import { describeHours } from '@/domain/time';
import type { SlotIndex } from '@/domain/types';

/**
 * Auskunft ueber die eigenen Daten. Artikel 15 DSGVO, M6.
 *
 * Der Anspruch ist nicht mit einem Satz in der Datenschutzerklaerung erfuellt —
 * es muss auch jemand beantworten koennen, was gespeichert ist. Ohne diese
 * Datei hiesse das: ein Admin sucht in sechs Tabellen zusammen, was zu einer
 * Person gehoert, und uebersieht dabei die siebte.
 *
 * Der Auszug ist deshalb bewusst **vollstaendig** und nicht huebsch: er nennt
 * jede Tabelle, in der etwas zu dieser Person steht, auch die technischen. Was
 * hier fehlt, faellt niemandem auf — also darf nichts fehlen.
 */

export interface DataExport {
  erstelltAm: string;
  hinweis: string;
  person: Readonly<Record<string, string>>;
  qualifikationen: readonly string[];
  erinnerungen: readonly string[];
  eintragungen: readonly string[];
  nachrichten: readonly string[];
  anmeldungen: readonly string[];
  verwaltung: readonly string[];
}

const timestamp = (value: Date | null): string =>
  value === null ? '—' : value.toISOString();

/** Alles, was zu dieser Person gespeichert ist — in lesbarer Form. */
export const buildDataExport = async (refereeId: string): Promise<DataExport | null> => {
  const rows = await db
    .select()
    .from(schema.referees)
    .where(eq(schema.referees.id, refereeId))
    .limit(1);
  const referee = rows[0];
  if (!referee) return null;

  const [quals, assignments, outbox, tokens, audit] = await Promise.all([
    db
      .select({ leagueId: schema.qualifications.leagueId })
      .from(schema.qualifications)
      .where(eq(schema.qualifications.refereeId, refereeId))
      .orderBy(asc(schema.qualifications.leagueId)),
    db
      .select({
        slotIndex: schema.assignments.slotIndex,
        claimedAt: schema.assignments.claimedAt,
        confirmedAt: schema.assignments.confirmedAt,
        playedAsReferee: schema.assignments.playedAsReferee,
        kickoff: schema.games.kickoff,
        home: schema.games.home,
        away: schema.games.away,
      })
      .from(schema.assignments)
      .innerJoin(schema.games, eq(schema.assignments.gameId, schema.games.id))
      .where(eq(schema.assignments.refereeId, refereeId))
      .orderBy(desc(schema.games.kickoff)),
    db
      .select({
        kind: schema.notificationOutbox.kind,
        channel: schema.notificationOutbox.channel,
        state: schema.notificationOutbox.state,
        sendAfter: schema.notificationOutbox.sendAfter,
        sentAt: schema.notificationOutbox.sentAt,
      })
      .from(schema.notificationOutbox)
      .where(eq(schema.notificationOutbox.recipientId, refereeId))
      .orderBy(desc(schema.notificationOutbox.sendAfter)),
    db
      .select({
        createdAt: schema.loginTokens.createdAt,
        usedAt: schema.loginTokens.usedAt,
        attempts: schema.loginTokens.attempts,
      })
      .from(schema.loginTokens)
      .where(eq(schema.loginTokens.refereeId, refereeId))
      .orderBy(desc(schema.loginTokens.createdAt)),
    db
      .select({
        action: schema.auditLog.action,
        createdAt: schema.auditLog.createdAt,
      })
      .from(schema.auditLog)
      .where(eq(schema.auditLog.subjectId, refereeId))
      .orderBy(desc(schema.auditLog.createdAt)),
  ]);

  return {
    erstelltAm: new Date().toISOString(),
    hinweis:
      'Dieser Auszug enthält alles, was diese Anwendung über dich gespeichert hat — ' +
      'auch die technischen Einträge. Fragen dazu beantwortet ein Admin der Abteilung.',
    person: {
      Name: referee.name,
      Kürzel: referee.initials,
      Telefonnummer: referee.phone,
      Rolle: referee.role === 'admin' ? 'Admin' : 'Schiedsrichter',
      Konto: referee.active ? 'aktiv' : 'stillgelegt',
      Profilbild: referee.avatarUrl ?? '—',
      'Zuletzt geöffneter Bildschirm': referee.lastScreen ?? '—',
      'Konto angelegt am': timestamp(referee.createdAt),
    },
    qualifikationen: quals.map((q) => q.leagueId),
    erinnerungen: referee.reminderHours.map((h) => `${describeHours(h)} vor Anpfiff`),
    eintragungen: assignments.map((a) => {
      const einsatz =
        a.playedAsReferee === null
          ? 'noch nicht nachgepflegt'
          : a.playedAsReferee
            ? 'als Schiedsrichter gepfiffen'
            : 'nicht gepfiffen';
      return (
        `${matchdayLabel(a.kickoff, CLUB.timeZone)}, ${timeLabel(a.kickoff, CLUB.timeZone)} Uhr · ` +
        `${a.home} gegen ${a.away} · ${SLOT_LABELS[a.slotIndex as SlotIndex]} · ` +
        `eingetragen ${timestamp(a.claimedAt)} · bestätigt ${timestamp(a.confirmedAt)} · ${einsatz}`
      );
    }),
    /*
     * Der Inhalt der Nachrichten steht bewusst nicht dabei: er entsteht beim
     * Versand aus Spiel und Person und laesst sich hier nicht rekonstruieren.
     * Was gespeichert ist — Art, Weg, Zustand, Zeitpunkt — steht vollstaendig da.
     */
    nachrichten: outbox.map(
      (m) =>
        `${m.kind} über ${m.channel} · ${m.state} · fällig ${timestamp(m.sendAfter)} · ` +
        `zugestellt ${timestamp(m.sentAt)}`,
    ),
    anmeldungen: tokens.map(
      (t) =>
        `angefordert ${timestamp(t.createdAt)} · eingelöst ${timestamp(t.usedAt)} · ` +
        `Fehlversuche ${t.attempts}`,
    ),
    verwaltung: audit.map((a) => `${a.action} am ${timestamp(a.createdAt)}`),
  };
};

/** Der Auszug als Textdatei, wie sie heruntergeladen wird. */
export const renderDataExport = (data: DataExport): string => {
  const block = (title: string, lines: readonly string[]): readonly string[] =>
    lines.length === 0
      ? [title, '  (nichts gespeichert)', '']
      : [title, ...lines.map((line) => `  ${line}`), ''];

  return [
    `Datenauszug · ${CLUB.appName} · ${CLUB.name}`,
    `Erstellt am ${data.erstelltAm}`,
    '',
    data.hinweis,
    '',
    'Person',
    ...Object.entries(data.person).map(([key, value]) => `  ${key}: ${value}`),
    '',
    ...block('Qualifikationen', data.qualifikationen),
    ...block('Persönliche Erinnerungen', data.erinnerungen),
    ...block('Eintragungen', data.eintragungen),
    ...block('Nachrichten', data.nachrichten),
    ...block('Anmeldungen', data.anmeldungen),
    ...block('Von Admins vorgenommene Änderungen', data.verwaltung),
  ].join('\n');
};
