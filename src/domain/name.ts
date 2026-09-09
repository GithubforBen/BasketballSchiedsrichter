/**
 * Vorname und Nachname — zwei Felder, ein Name.
 *
 * Die Datenbank haelt beides getrennt: `name` ist der volle Name, unter dem
 * die Person ueberall auftaucht, `firstName` die Anrede jeder Nachricht. Beide
 * werden von Hand gepflegt, und genau daraus entstand ein Fehler, der lange
 * niemandem auffiel: wer beim Import die Spalten „Vorname“ und „Name“ einer
 * Vereinsliste uebernimmt, hat in `name` nur den *Nachnamen* stehen. Sichtbar
 * wurde das erst am Start-Passwort, denn das folgt nach Regel 35 aus `name` —
 * aus „Linda Schnorrenberger“ wurde `schnorrenberger` statt
 * `lindaschnorrenberger`.
 *
 * Deshalb stehen in der Verwaltung jetzt zwei Felder, und der volle Name
 * entsteht aus ihnen. Die beiden ersten Funktionen hier sind das Scharnier
 * dazwischen: `surnameOf` fuellt das Formular, `composeName` liest es zurueck.
 *
 * Am Ende der Datei steht, was daraus folgt: wer nach Nachnamen ordnen will,
 * muss ihn erst gewinnen. Deshalb liegt auch die Sortierung hier.
 */

/** Mehrfache Leerzeichen und Rand weg — sonst vergleicht sich nichts sauber. */
const collapse = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Ob `value` mit `prefix` als *ganzem Wort* beginnt.
 *
 * „Ben Schnorrenberger“ beginnt mit „Ben“, „Bengt Meier“ nicht — sonst bliebe
 * beim Abschneiden ein „t Meier“ stehen. Gross- und Kleinschreibung zaehlt
 * nicht: getippt wird von Menschen.
 */
const startsWithWord = (value: string, prefix: string): boolean => {
  if (prefix === '') return false;
  const a = value.toLocaleLowerCase('de-DE');
  const b = prefix.toLocaleLowerCase('de-DE');
  return a === b || a.startsWith(`${b} `);
};

/**
 * Der Nachname, wie er ins Formular gehoert.
 *
 * Steht der Vorname schon vorn im vollen Namen — „Ben Schnorrenberger“ mit
 * Vorname „Ben“ —, bleibt „Schnorrenberger“ uebrig. Steht er nicht darin, ist
 * der ganze Wert der Nachname: genau der Fall aus der importierten
 * Vereinsliste.
 */
export const surnameOf = (name: string, firstName: string): string => {
  const full = collapse(name);
  const first = collapse(firstName);
  if (first === '') return full;
  if (!startsWithWord(full, first)) return full;
  return full.slice(first.length).trim();
};

/**
 * Der volle Name aus beiden Feldern.
 *
 * Was schon dasteht, wird nicht angehaengt. Das klingt nach Kosmetik, ist aber
 * die Zusicherung, die diese Umstellung ueberhaupt gefahrlos macht: ein Konto,
 * in dem jemand den vollen Namen versehentlich ins Vornamen-Feld getippt hat,
 * darf durch ein blosses Speichern nicht zu „Jan Schnorrenberger Jan“ werden.
 * Ein Formular, das Daten beim unveraenderten Abschicken verschlechtert, waere
 * schlimmer als das Feld, das vorher fehlte.
 */
export const composeName = (firstName: string, surname: string): string => {
  const first = collapse(firstName);
  const last = collapse(surname);
  if (first === '') return last;
  if (last === '') return first;
  if (startsWithWord(first, last)) return first;
  if (startsWithWord(last, first)) return last;
  return `${first} ${last}`;
};

/** Eine Person, soweit die Sortierung sie kennen muss. */
export interface NameOrdered {
  readonly id: string;
  readonly name: string;
  readonly firstName: string;
}

/**
 * Die Ordnung jeder Personenliste: Nachname, dann Vorname.
 *
 * Ohne sie kam die Reihenfolge aus der Datenbank, und die ist keine: eine
 * Abfrage ohne `ORDER BY` darf jede Reihenfolge liefern und muss ihre eigene
 * nicht einmal beibehalten. Solange die Liste kurz ist, faellt das nicht auf;
 * verlassen kann man sich darauf trotzdem nicht.
 *
 * Verglichen wird der Nachname aus `surnameOf` und nicht der volle Name: sonst
 * ordnete die Liste nach Vornamen, weil der vorn steht. Bei gleichem Nachnamen
 * entscheidet der Vorname, und zuletzt die Kennung — zwei Menschen koennen
 * denselben Namen tragen, und auch dann soll die Liste stillstehen.
 *
 * `localeCompare` mit `de`, damit Umlaute dort stehen, wo sie im Telefonbuch
 * stehen: Ätzel zwischen Atzel und Auer, nicht hinter Zwingli.
 */
export const compareByName = (a: NameOrdered, b: NameOrdered): number =>
  surnameOf(a.name, a.firstName).localeCompare(surnameOf(b.name, b.firstName), 'de') ||
  collapse(a.firstName).localeCompare(collapse(b.firstName), 'de') ||
  a.id.localeCompare(b.id);

/**
 * Dieselbe Ordnung, Admins zuerst — fuer die Schiedsrichter-Verwaltung.
 *
 * Wer dort etwas sucht, sucht meistens sich selbst oder die andere Person, die
 * eintragen darf. Die stehen jetzt oben, statt irgendwo zwischen dreissig
 * Namen. Innerhalb beider Gruppen bleibt es alphabetisch.
 */
export const compareAdminsFirst = (
  a: NameOrdered & { readonly role: 'referee' | 'admin' },
  b: NameOrdered & { readonly role: 'referee' | 'admin' },
): number =>
  Number(b.role === 'admin') - Number(a.role === 'admin') || compareByName(a, b);
