import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { logEvent } from '@/server/log';
import { runScheduler, previewScheduler } from '@/server/scheduler';

/**
 * Der Endpunkt, der Fristen und Erinnerungen abarbeitet.
 *
 * Ein Zeitplan von aussen ruft ihn regelmaessig auf — jede Minute schadet
 * nicht, weil ein Lauf ohne Faelliges nichts tut und ein doppelter Lauf an den
 * Idempotenzschluesseln der Outbox scheitert.
 *
 * POST arbeitet ab, GET zeigt nur, was abzuarbeiten waere. Der Trockenlauf ist
 * bewusst der lesende Weg: ein vorausschauender Browser oder ein Linkpruefer
 * darf keine Nachrichten ausloesen, die Geld kosten (Regel 33).
 */
export const dynamic = 'force-dynamic';

/**
 * Vergleich in gleichbleibender Zeit.
 *
 * Ein `===` verraet ueber die Antwortzeit, wie viele Zeichen stimmen. Beim
 * Sitzungsschluessel wird das schon so gehandhabt, hier gilt dasselbe.
 */
const authorised = (request: Request): boolean => {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.trim() === '' || expected === 'bitte-ersetzen') return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

const denied = (): NextResponse =>
  NextResponse.json({ error: 'Nicht berechtigt.' }, { status: 401 });

export const POST = async (request: Request): Promise<NextResponse> => {
  if (!authorised(request)) return denied();
  const run = await runScheduler();
  /*
   * Ein Lauf ohne Faelliges bleibt still. Sonst schriebe der Zeitgeber alle
   * fuenf Minuten eine Zeile, und die eine Zeile, auf die es ankommt, ginge
   * darin unter.
   */
  if (run.queued > 0 || run.dispatch.sent > 0 || run.dispatch.failed > 0) {
    logEvent('cron.lauf', {
      angelegt: run.queued,
      zugestellt: run.dispatch.sent,
      wiederholt: run.dispatch.retried,
      aufgegeben: run.dispatch.failed,
      einheiten: run.dispatch.cost,
      grenze: run.dispatch.stoppedBy,
    });
  }
  return NextResponse.json(run);
};

export const GET = async (request: Request): Promise<NextResponse> => {
  if (!authorised(request)) return denied();
  const intents = await previewScheduler();
  return NextResponse.json({
    faellig: intents.length,
    einheiten: intents.reduce((sum, intent) => sum + intent.recipientIds.length, 0),
    nach_art: intents.reduce<Record<string, number>>((counts, intent) => {
      counts[intent.kind] = (counts[intent.kind] ?? 0) + 1;
      return counts;
    }, {}),
  });
};
