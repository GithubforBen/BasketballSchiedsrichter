import { NextResponse } from 'next/server';
import { buildDataExport, renderDataExport } from '@/server/auskunft';
import { requireUser } from '@/server/guard';

/**
 * Der eigene Datenauszug zum Herunterladen. Artikel 15 DSGVO.
 *
 * Bewusst Selbstbedienung und nicht "bitte beim Admin melden": ein Anspruch,
 * fuer den man erst jemanden ansprechen muss, wird selten eingeloest. Und
 * bewusst nur fuer die **eigenen** Daten — `requireUser` liefert die Person aus
 * der Sitzung, eine Id aus der Adresse gibt es hier nicht. Sonst waere der
 * Auskunftsanspruch ein Weg, die Telefonnummer aller anderen abzufragen.
 */
export const dynamic = 'force-dynamic';

export const GET = async (): Promise<NextResponse> => {
  const user = await requireUser();
  const data = await buildDataExport(user.id);
  if (!data) return NextResponse.json({ error: 'Konto nicht gefunden.' }, { status: 404 });

  return new NextResponse(renderDataExport(data), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'content-disposition': 'attachment; filename="schiriplan-datenauszug.txt"',
      // Ein Auszug ist eine Momentaufnahme und darf nirgends zwischengelagert werden.
      'cache-control': 'no-store',
    },
  });
};
