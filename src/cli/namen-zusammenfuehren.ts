/**
 * Zieht Namen gerade, in denen nur der Nachname steht.
 *
 * Wer eine Vereinsliste mit den Spalten „Vorname“ und „Name“ eins zu eins
 * importiert hat, hat in `referees.name` den **Nachnamen** stehen und den
 * Vornamen daneben. Sichtbar wird das an zwei Stellen: die Anwendung zeigt
 * ueberall nur den Nachnamen, und das Start-Passwort heisst nach Regel 35
 * genauso — „schnorrenberger“ statt „lindaschnorrenberger“.
 *
 * In der Verwaltung laesst sich das jetzt Zeile fuer Zeile richtigstellen.
 * Fuer eine ganze Abteilung ist das dreissigmal dasselbe; dieses Skript macht
 * es in einem Zug.
 *
 * **Was dabei mit dem Passwort geschieht.** Das Start-Passwort liegt nirgends,
 * es folgt aus dem Namen — einmal beim Setzen fuer den gespeicherten Hash und
 * einmal beim Anzeigen in der Tabelle. Aendert sich der Name, muessen beide
 * mitgehen, sonst stuende in der Tabelle ein Passwort, mit dem sich niemand
 * anmelden kann. Betroffen sind nur Konten, fuer die noch das Start-Passwort
 * gilt: dort wird es neu gesetzt, die 14-Tage-Frist beginnt von vorn und alle
 * offenen Sitzungen dieser Konten fallen weg. Wer laengst ein eigenes Passwort
 * hat, merkt von alldem nichts.
 *
 * Aufruf:
 *   npx tsx --tsconfig tsconfig.skripte.json src/cli/namen-zusammenfuehren.ts [--anwenden]
 *
 * Ohne `--anwenden` wird nichts geschrieben — der Lauf zeigt nur, was er
 * aendern wuerde. Sehen Sie sich die Liste an: aus einer Zeile, in der jemand
 * den vollen Namen ins Vornamen-Feld getippt hat, kann kein Skript raten,
 * was gemeint war.
 */
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { composeName, surnameOf } from '@/domain/name';
import { passwordState } from '@/domain/password';
import { applyStartPassword } from '@/server/auth/password-login';

const commit = process.argv.includes('--anwenden');
const now = new Date();

const rows = await db
  .select({
    id: schema.referees.id,
    name: schema.referees.name,
    firstName: schema.referees.firstName,
    ownPasswordSetAt: schema.referees.ownPasswordSetAt,
    startPasswordExpiresAt: schema.referees.startPasswordExpiresAt,
  })
  .from(schema.referees);

const pending = rows.flatMap((row) => {
  const next = composeName(row.firstName, surnameOf(row.name, row.firstName));
  return next === '' || next === row.name ? [] : [{ ...row, next }];
});

console.log(`${rows.length} Konten gelesen, ${pending.length} mit unvollständigem Namen.`);
if (pending.length === 0) process.exit(0);

for (const row of pending) {
  const onStart = passwordState(row, now) === 'start';
  console.log(
    `  „${row.name}“ + Vorname „${row.firstName}“ → „${row.next}“` +
      (onStart ? '  (Start-Passwort wird neu gesetzt)' : '  (eigenes Passwort, bleibt)'),
  );
}

if (!commit) {
  console.log('\nTrockenlauf. Zum wirklichen Ändern dieselbe Zeile mit --anwenden.');
  process.exit(0);
}

let renamed = 0;
let reissued = 0;
for (const row of pending) {
  const onStart = passwordState(row, now) === 'start';
  await db
    .update(schema.referees)
    .set({ name: row.next })
    .where(eq(schema.referees.id, row.id));
  renamed += 1;
  /*
   * Nach dem Namen der Hash — in dieser Reihenfolge, damit die Tabelle nach
   * einem Abbruch mittendrin hoechstens einen Namen ohne passendes Passwort
   * zeigt und nicht ein Passwort ohne passenden Namen.
   */
  if (onStart) {
    await applyStartPassword(row.id, row.next, now);
    reissued += 1;
  }
}

console.log(
  `\n${renamed} Namen geändert, davon ${reissued} mit neuem Start-Passwort. ` +
    'Die Passwörter stehen in der Schiedsrichter-Verwaltung — sie liegen nirgends gespeichert.',
);
process.exit(0);
