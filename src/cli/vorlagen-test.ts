/**
 * Schickt je eine Nachricht pro WhatsApp-Vorlage an eine Nummer.
 *
 * Ob eine Vorlage bei Meta angelegt und freigegeben ist, sagt kein Endpunkt —
 * es zeigt sich erst am Versand. Dieses Skript geht deshalb alle Nachrichtenarten
 * durch, rendert jede mit Beispielwerten und schickt sie einzeln los. Der
 * Fehlercode aus der Cloud API steht danach neben dem Vorlagennamen:
 *
 *   132001  Vorlage gibt es in dieser Sprache nicht
 *   132000  Anzahl der Werte passt nicht zur freigegebenen Vorlage
 *
 * Aufruf:  npx tsx --tsconfig tsconfig.skripte.json src/cli/vorlagen-test.ts +49…
 */
import { answerClaimsFor, issueAnswerToken } from '@/notifications/action-links';
import { channelsByName } from '@/notifications/channel';
import { renderMessage } from '@/notifications/templates';
import { NOTIFICATION_KINDS, type NotificationKind } from '@/domain/notifications';
import type { Game } from '@/domain/types';
import { CLUB } from '@/config/club';
import { env } from '@/server/env';

const phone = process.argv[2];
if (!phone) throw new Error('Nummer fehlt. Aufruf: … src/cli/vorlagen-test.ts +4915226693501');

const now = new Date();
const inDays = (days: number): Date => new Date(now.getTime() + days * 86_400_000);

/* Ein erfundenes Spiel — es geht um die Vorlagen, nicht um die Daten. */
const game: Game = {
  id: 'vorlagen-test',
  kickoff: inDays(3),
  leagueId: 'U14',
  leagueLabel: 'XU14Bz',
  home: 'VfL Bensheim',
  away: 'TV Heppenheim 3',
  venue: 'Sportzentrum am Orpheum',
  state: 'scheduled',
  requiredLicense: 'E',
} as Game;

const cancelled: Game = { ...game, state: 'cancelled' };

/** Beispielwerte je Art — genau die Felder, die der jeweilige Text liest. */
const payloads: Record<NotificationKind, Readonly<Record<string, unknown>>> = {
  assignment: { slotIndex: 0 },
  'confirmation-request': {},
  'confirmation-follow-up': {},
  'promotion-offer': { targetSlot: 1, respondBy: inDays(1).toISOString(), offerId: 'test-1' },
  'open-slot-announcement': {},
  'admin-open-slots': {
    gamesWithGap: 7,
    gamesWithoutAny: 3,
    nextKickoff: inDays(2).toISOString(),
  },
  relocation: {
    previousKickoff: inDays(5).toISOString(),
    previousVenue: 'Weststadthalle Bensheim',
  },
  'personal-reminder': { hoursBefore: 72 },
  'admin-alert': { detail: 'Für dieses Spiel fehlt seit drei Tagen der zweite Schiedsrichter.' },
  'daily-digest': {
    lines: ['Sa 12.09., 18:00 · ein Platz offen', 'So 13.09., 10:30 · Bestätigung fehlt'],
  },
  login: {
    subject: `Anmeldung bei ${CLUB.appName}`,
    body: 'Testnachricht der Vorlagenprüfung.',
    code: '123456',
  },
};

/* Die Verlegung hat zwei Vorlagen: verlegt und abgesagt. Beide werden geprüft. */
const cases: readonly { kind: NotificationKind; game: Game; note: string }[] = [
  ...NOTIFICATION_KINDS.map((kind) => ({ kind, game, note: '' })),
  { kind: 'relocation' as const, game: cancelled, note: ' (abgesagt)' },
];

const recipient = { refereeId: 'vorlagen-test', name: 'Ben', phone };
let ok = 0;
let fail = 0;

for (const [index, testCase] of cases.entries()) {
  const key = `vorlagentest:${testCase.kind}:${index}`;
  const claims = answerClaimsFor(testCase.kind, {
    gameId: testCase.game.id,
    refereeId: recipient.refereeId,
    key,
    payload: payloads[testCase.kind],
    game: testCase.game,
  });

  const rendered = renderMessage(testCase.kind, {
    recipientName: recipient.name,
    game: testCase.game,
    payload: payloads[testCase.kind],
    baseUrl: env.baseUrl,
    timeZone: CLUB.timeZone,
    now,
    answerToken: claims ? issueAnswerToken(claims, env.sessionSecret) : null,
  });

  const name = rendered.template?.name ?? '(keine Vorlage)';
  const label = `${testCase.kind}${testCase.note}`.padEnd(28);

  try {
    await channelsByName.whatsapp.send({ ...rendered, kind: testCase.kind, key, recipient });
    ok += 1;
    console.log(`✓ ${label} ${name}`);
  } catch (error) {
    fail += 1;
    console.log(`✗ ${label} ${name}\n    ${error instanceof Error ? error.message : String(error)}`);
  }

  /* Meta drosselt bei zu schnellen Folgen; eine Sekunde reicht. */
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.log(`\n${ok} zugestellt, ${fail} gescheitert, ${cases.length} geprüft.`);
console.log(`Antwortlinks zeigen auf ${env.baseUrl}`);
