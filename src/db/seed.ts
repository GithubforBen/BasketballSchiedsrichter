import { randomUUID } from 'node:crypto';
import { CLUB, INITIAL_LEAGUES } from '@/config/club';
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
 * Fuellt eine leere Datenbank mit den Daten aus dem Mockup.
 * Ausschliesslich fuer Entwicklung und Tests — der Produktivbestand entsteht
 * ueber `seed:admin` und den CSV-Import.
 */
const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'yes') {
    throw new Error('Der Beispiel-Seed laeuft nicht gegen die Produktivdatenbank.');
  }

  await db.insert(schema.leagues).values(
    INITIAL_LEAGUES.map((name, index) => ({ id: name, name, sortOrder: index })),
  );

  await db.insert(schema.referees).values(
    SEED_REFEREES.map((referee) => ({
      id: referee.id,
      name: referee.name,
      initials: referee.initials,
      phone: referee.phone,
      role: referee.role,
      reminderHours: referee.id === 'r-jk' ? [48, 3] : [24],
    })),
  );

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
        kickoff: toKickoff(game.kickoffLocal, CLUB.timeZone),
        leagueId: game.leagueId,
        home: game.home,
        away: game.away,
        venue: game.venue,
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

  await db.insert(schema.settings).values({ id: 1 });

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
