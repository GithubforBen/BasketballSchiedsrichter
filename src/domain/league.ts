/**
 * Ligen: die gedeutete Altersklasse und das Kuerzel, aus dem sie stammt.
 *
 * Der Verband schreibt Ligen nicht einheitlich. `XU14Bz` traegt die Klasse
 * mitten im Wort, `Herren Kreisliga B, Gruppe 1` gar keine. Die Anwendung
 * braucht beides: die Klasse, um Qualifikationen zu pruefen, und das Kuerzel,
 * weil darin steht, was die Klasse allein nicht sagt.
 */

/** Die Liga fuer alles, worin keine Altersklasse steckt. */
export const ADULT_LEAGUE = 'Senioren';

/**
 * Die Altersklasse aus einem Liga-Kuerzel.
 *
 * Gesucht wird das erste `U` mit ein oder zwei Ziffern — **ohne** Wortgrenze
 * davor, sonst faende sich das `U14` in `XU14Bz` nicht. Findet sich keine, ist
 * es ein Spiel der Erwachsenen und gehoert zu `Senioren`.
 *
 * Die Ziffern laufen durch `Number`, damit `U06` und `U6` dieselbe Liga
 * ergeben und nicht zwei.
 */
export const leagueFromLabel = (label: string): string => {
  const match = /u\s?-?(\d{1,2})/i.exec(label);
  return match ? `U${Number(match[1])}` : ADULT_LEAGUE;
};

/**
 * Die Altersklasse als Zahl, oder `null` fuer alles ohne eine.
 *
 * `U10` ergibt 10. Bei einer Liga ist die Kennung zugleich ihr Name, deshalb
 * genuegt dieselbe Deutung wie beim Kuerzel.
 */
const ageClass = (leagueId: string): number | null => {
  const match = /^u\s?-?(\d{1,2})$/i.exec(leagueId.trim());
  return match ? Number(match[1]) : null;
};

/**
 * Die Reihenfolge der Ligen: nach Alter, Erwachsene zuletzt.
 *
 * U10 vor U12 vor U14 — die Jugend steigt auf, und `Senioren` steht am Ende.
 * Sortiert wird gerechnet und nicht von Hand gepflegt: eine neu angelegte
 * Liga sitzt sonst dort, wo ihre Platzziffer sie zufaellig hinsetzt. `U10`
 * und `U12` standen so hinter `Senioren`, weil sie spaeter dazukamen.
 *
 * Rein alphabetisch ginge es nicht: `U100` stuende vor `U9`, und `U9` hinter
 * `U18`. Verglichen wird deshalb die Zahl.
 */
export const compareLeagues = (
  a: { readonly id: string },
  b: { readonly id: string },
): number => {
  const left = ageClass(a.id);
  const right = ageClass(b.id);
  if (left !== null && right !== null) return left - right;
  // Was keine Altersklasse traegt, gehoert ans Ende — und dort alphabetisch.
  if (left !== null) return -1;
  if (right !== null) return 1;
  return a.id.localeCompare(b.id, 'de');
};

/**
 * Was am Spiel steht.
 *
 * Das Kuerzel des Verbands, solange es eines gibt — es sagt mehr als die
 * Altersklasse: wer `U16` liest, weiss noch nicht, ob es die maennliche
 * Staffel ist, und genau das entscheidet manchen vor dem Eintragen. Spiele,
 * die von Hand angelegt wurden, haben keins; dann steht die Liga selbst da.
 */
export const leagueDisplay = (game: {
  readonly leagueId: string;
  readonly leagueLabel: string;
}): string => (game.leagueLabel.trim() === '' ? game.leagueId : game.leagueLabel);
