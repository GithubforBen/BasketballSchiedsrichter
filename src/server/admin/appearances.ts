import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import type { SlotIndex } from '@/domain/types';
import type { AdminResult } from './games';

/**
 * Spiele nachpflegen. Regel 27.
 *
 * Nachruecken zaehlt automatisch — wer am Ende auf einem Schiedsrichter-Platz
 * steht, hat gepfiffen. Fuer alles, was danebengeht (ein Ersatz springt
 * spontan ein, jemand faellt kurzfristig aus), traegt der Admin hier nach.
 * Die Zahl ist abrechnungsrelevant, deshalb muss sie korrigierbar sein.
 */
export const setPlayedAsReferee = async (
  actorId: string,
  gameId: string,
  slotIndex: SlotIndex,
  played: boolean,
): Promise<AdminResult> => {
  const updated = await db
    .update(schema.assignments)
    .set({ playedAsReferee: played })
    .where(and(eq(schema.assignments.gameId, gameId), eq(schema.assignments.slotIndex, slotIndex)))
    .returning({ refereeId: schema.assignments.refereeId });

  const refereeId = updated[0]?.refereeId;
  if (!refereeId) return { ok: false, message: 'Dieser Platz war nicht belegt.' };

  await db.insert(schema.auditLog).values({
    id: randomUUID(),
    actorId,
    action: 'appearance.set',
    gameId,
    subjectId: refereeId,
    detail: { slotIndex, played },
  });

  return {
    ok: true,
    message: played ? 'Als Einsatz gezählt.' : 'Zählt nicht als Einsatz.',
  };
};
