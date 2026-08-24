import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db';

/**
 * Lebenszeichen fuer den Compose-Verbund.
 *
 * Bewusst mit einer echten Abfrage: ein Prozess, der laeuft, aber die Datenbank
 * nicht erreicht, kann nichts ausliefern. Ein Healthcheck, der nur "ich lebe"
 * sagt, wuerde genau diesen Fall verschweigen.
 *
 * Ohne Zugangsschutz, weil der Endpunkt nichts verraet: eine Zahl und ein Wort.
 * Er nennt weder Fassung noch Fehlermeldung — beides waere ein kostenloser
 * Hinweis fuer jemanden, der die Anwendung abklopft.
 */
export const dynamic = 'force-dynamic';

export const GET = async (): Promise<NextResponse> => {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'datenbank-nicht-erreichbar' }, { status: 503 });
  }
};
