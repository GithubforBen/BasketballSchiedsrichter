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
 * entsteht aus ihnen. Die beiden Funktionen hier sind das Scharnier dazwischen:
 * `surnameOf` fuellt das Formular, `composeName` liest es zurueck.
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
