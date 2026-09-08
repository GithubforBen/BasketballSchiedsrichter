import { db, schema } from '@/db';
import { compareLeagues } from '@/domain/league';

/**
 * Alle Ligen des Vereins, auch abgeschaltete — nach Altersklasse geordnet.
 *
 * Die Reihenfolge wird gerechnet und nicht aus `sort_order` genommen: die
 * Platzziffer stammt aus dem Moment des Anlegens, und eine spaeter ergaenzte
 * Liga landete damit hinten. `U10` und `U12` standen so hinter `Senioren`.
 * Die Spalte bleibt, weil das Schema sie kennt; massgeblich ist sie nicht mehr.
 *
 * Sie kommen aus der Datenbank und nicht aus `INITIAL_LEAGUES`: die Konstante
 * beschreibt nur, womit ein frischer Verein anfaengt. Wer sie als Anzeigeliste
 * benutzt, blendet jede spaeter angelegte Liga aus — eine Qualifikation fuer
 * U10 waere dann zwar vergeben, aber nirgends zu sehen.
 */
export const loadLeagues = async () =>
  (await db.select().from(schema.leagues)).sort(compareLeagues);
