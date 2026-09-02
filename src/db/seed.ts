import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { CLUB, INITIAL_LEAGUES } from '@/config/club';
import { startPassword } from '@/domain/password';
import { hashPassword } from '@/server/auth/hash';
import { db, schema, sql } from './index';
import {
  SEED_GAMES,
  SEED_PAST_GAMES,
  SEED_REFEREES,
  SEED_SUBSTITUTE_APPEARANCES,
  toKickoff,
  type SeedGame,
} from './seed-data';

/**
 * Die Vorgaben der Einstellungstabelle, wie das Schema sie setzt.
 *
 * Sie stehen hier ausgeschrieben, weil ein `INSERT ... ON CONFLICT DO UPDATE`
 * die Spalten nennen muss, die es zuruecksetzen soll — die Vorgabewerte der
 * Spalten greifen nur beim Einfuegen.
 */
const DEFAULT_DB_SETTINGS = {
  withdrawDeadlineDays: 21,
  substituteRequestDeadlineDays: 3,
  confirmationLeadHours: 72,
  confirmationFollowUpHours: 24,
  reminderLimit: 10,
  reminderCostWarningFrom: 4,
  reminderMinHours: 1,
  reminderMaxHours: 168,
  promotionResponseHours: 12,
  oneGamePerDay: true,
  rotation: true,
  rotationWindow: 'week',
  autoNudge: true,
  openSlotVisibility: 'all',
  assignmentReceipt: true,
  alertUnfilled: true,
  alertConfirmationOverdue: true,
  alertSubstituteMissing: true,
  alertCancellation: true,
  alertDailyDigest: true,
  alertAfterImport: false,
} as const;

/**
 * Fuellt eine leere Datenbank mit den Daten aus dem Mockup.
 * Ausschliesslich fuer Entwicklung und Tests — der Produktivbestand entsteht
 * ueber `seed:admin` und den CSV-Import.
 */
const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'yes') {
    throw new Error('Der Beispiel-Seed laeuft nicht gegen die Produktivdatenbank.');
  }

  /*
   * Die Ligen stehen moeglicherweise schon: die Integrationstests legen sie
   * selbst an, und in der CI laeuft der Seed nach ihnen. Sie gehoeren keinem
   * Lauf allein — wer sie vorfindet, laesst sie stehen.
   */
  await db
    .insert(schema.leagues)
    .values(INITIAL_LEAGUES.map((name, index) => ({ id: name, name, sortOrder: index })))
    .onConflictDoNothing();

  await db.insert(schema.referees).values(
    SEED_REFEREES.map((referee) => ({
      id: referee.id,
      name: referee.name,
      firstName: referee.firstName,
      initials: referee.initials,
      phone: referee.phone,
      role: referee.role,
      license: referee.license,
      reminderHours: referee.id === 'r-jk' ? [48, 3] : [24],
    })),
  );

  /*
   * Jeder Beispiel-Schiri bekommt sein Passwort aus dem Namen — "jonaskeller",
   * "lenabrandt" und so fort. Ohne das kaeme man in die Beispieldaten gar nicht
   * hinein.
   *
   * Es gilt hier als *eigenes* Passwort und nicht als Start-Passwort: sonst
   * stuende bei jeder Anmeldung in der Entwicklung zuerst der erzwungene
   * Wechsel aus Regel 37 im Weg. Wie der aussieht, zeigt jedes neu angelegte
   * Konto — das bekommt seinen Zwang ueber `createReferee` wie im Betrieb.
   *
   * Gespeichert ist auch hier nur der Hash (Regel 39); ein fest eingetragener
   * Hash im Quelltext waere ein Passwort, das in jeder Installation dasselbe
   * ist.
   */
  const seededAt = new Date();
  for (const referee of SEED_REFEREES) {
    await db
      .update(schema.referees)
      .set({
        passwordHash: await hashPassword(startPassword(referee.name)),
        ownPasswordSetAt: seededAt,
        startPasswordExpiresAt: null,
      })
      .where(eq(schema.referees.id, referee.id));
  }

  await db.insert(schema.qualifications).values(
    SEED_REFEREES.flatMap((referee) =>
      referee.qualifications.map((leagueId) => ({ refereeId: referee.id, leagueId })),
    ),
  );

  const appearances = new Set(
    SEED_SUBSTITUTE_APPEARANCES.map((a) => `${a.gameId}:${a.slotIndex}`),
  );

  const insertGames = async (games: readonly SeedGame[], past: boolean): Promise<void> => {
    for (const game of games) {
      await db.insert(schema.games).values({
        id: game.id,
        kickoff: toKickoff(game, CLUB.timeZone),
        leagueId: game.leagueId,
        home: game.home,
        away: game.away,
        venue: game.venue,
        requiredLicense: game.requiredLicense ?? 'E',
        state: game.state ?? 'scheduled',
        relocationVersion: game.state === 'moved' ? 1 : 0,
      });

      const rows = game.slots.flatMap((refereeId, slotIndex) => {
        if (refereeId === null) return [];
        const confirmed = game.confirmed?.includes(slotIndex) ?? false;
        return [
          {
            gameId: game.id,
            slotIndex,
            refereeId,
            confirmedAt: confirmed ? new Date() : null,
            // Nur bei vergangenen Spielen ist der Einsatz entschieden. Regel 27.
            playedAsReferee: past
              ? slotIndex < 2 || appearances.has(`${game.id}:${slotIndex}`)
              : null,
          },
        ];
      });
      if (rows.length > 0) await db.insert(schema.assignments).values(rows);
    }
  };

  await insertGames(SEED_GAMES, false);
  await insertGames(SEED_PAST_GAMES, true);

  /*
   * Ebenso die Einstellungen: die Integrationstests speichern welche, und in
   * der CI laufen sie vor dem Seed. Der Seed setzt sie auf die Vorgaben
   * zurueck, statt an einer belegten Zeile zu scheitern — nach ihm soll der
   * Stand der Vorgabe entsprechen und nicht dem, was ein Test hinterlassen hat.
   */
  await db
    .insert(schema.settings)
    .values({ id: 1 })
    .onConflictDoUpdate({ target: schema.settings.id, set: DEFAULT_DB_SETTINGS });

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    action: 'seed',
    detail: { games: SEED_GAMES.length + SEED_PAST_GAMES.length, referees: SEED_REFEREES.length },
  });

  console.log(
    `Seed fertig: ${SEED_REFEREES.length} Personen, ${SEED_GAMES.length} kommende und ${SEED_PAST_GAMES.length} vergangene Spiele.`,
  );
};

run()
  .then(() => sql.end())
  .catch(async (error: unknown) => {
    console.error(error);
    await sql.end();
    process.exit(1);
  });
