/**
 * Telefonnummern.
 *
 * Gespeichert wird ausschliesslich E.164 (`+49151…`), weil der Nachrichtenversand
 * kein Format raten darf und weil die Anmeldung ueber die Nummer laeuft: dieselbe
 * Person muss dieselbe Zeichenkette ergeben, egal wie sie sie eintippt.
 */

/** Vorwahl, die bei nationaler Schreibweise ("0151…") angenommen wird. */
const DEFAULT_COUNTRY_CODE = '49';

export type PhoneResult =
  | { readonly ok: true; readonly phone: string }
  | { readonly ok: false; readonly message: string };

/**
 * Die Nummer wird zurechtgebogen, nicht zurueckgewiesen.
 *
 * Jede uebliche Schreibweise fuehrt auf dieselbe gespeicherte Nummer:
 *
 * | Eingabe              | Ergebnis         |
 * | -------------------- | ---------------- |
 * | `+49 1522 6693501`   | `+4915226693501` |
 * | `01522 6693501`      | `+4915226693501` |
 * | `0049 1522 6693501`  | `+4915226693501` |
 * | `1522 6693501`       | `+4915226693501` |
 * | `4915226693501`      | `+4915226693501` |
 * | `+49 01522 6693501`  | `+4915226693501` |
 *
 * Die letzten drei Zeilen waren frueher Fehlermeldungen. Sie sind es nicht
 * mehr, weil in allen dreien steht, was gemeint ist: eine deutsche Mobilnummer
 * beginnt national mit einer `1`, und `49` am Anfang einer *langen* Nummer
 * kann nur die Landesvorwahl sein. Die Null hinter der Landesvorwahl wird
 * still gestrichen, statt eine Belehrung auszuloesen — sie ist ein Vertipper
 * und keine Entscheidung.
 *
 * Nicht geraten wird dort, wo Raten eine *andere* Nummer ergaebe: `41 79 …`
 * ohne Plus koennte die Schweiz sein oder eine deutsche Ortsvorwahl ohne Null.
 * Eine falsch geratene Nummer faellt niemandem auf — die Nachrichten kommen
 * einfach nie an, und bezahlt sind sie trotzdem (Regel 33). Dieser eine Fall
 * bleibt deshalb eine Nachfrage.
 */
export const normalisePhone = (input: string): PhoneResult => {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, message: 'Bitte gib deine Telefonnummer ein.' };
  }

  // Alles ausser Ziffern und einem fuehrenden Plus faellt weg: Leerzeichen,
  // Schraegstriche, Klammern und Bindestriche sind reine Schreibweise.
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (digits === '') {
    return { ok: false, message: 'Die Nummer enthält keine Ziffern.' };
  }

  let international: string;
  if (hasPlus) {
    international = digits;
  } else if (digits.startsWith('00')) {
    international = digits.slice(2);
  } else if (digits.startsWith('0')) {
    international = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  } else if (digits.startsWith(DEFAULT_COUNTRY_CODE) && digits.length >= 11) {
    /*
     * "4915226693501" — die Landesvorwahl ohne Plus. Die Laenge entscheidet:
     * eine *nationale* Nummer, die mit 49 beginnt, ist eine Ortsvorwahl ohne
     * ihre Null (Leer ist 0491) und kommt auf hoechstens zehn Ziffern. Ab elf
     * kann nur die Landesvorwahl gemeint sein.
     */
    international = digits;
  } else if (digits.startsWith('1')) {
    // Nationale Mobilnummer, bei der die fuehrende Null fehlt: 15x, 16x, 17x.
    international = `${DEFAULT_COUNTRY_CODE}${digits}`;
  } else {
    return {
      ok: false,
      message: 'Bitte mit Vorwahl angeben, z. B. 0151 23456789 oder +49 151 23456789.',
    };
  }

  /*
   * Landesvorwahl und nationale Null zusammen ("+49 0151 …") ist der haeufigste
   * Vertipper. Gemeint ist offensichtlich dieselbe Nummer ohne die Null, also
   * faellt sie weg. Frueher stand hier eine Fehlermeldung; sie hat niemanden
   * vor einer falschen Nummer bewahrt, sondern nur das Eintragen aufgehalten.
   */
  const withoutNationalZero = new RegExp(`^(${DEFAULT_COUNTRY_CODE})0+`);
  international = international.replace(withoutNationalZero, '$1');

  if (international.startsWith('0')) {
    return { ok: false, message: 'Nach der Landesvorwahl darf keine Null stehen.' };
  }
  if (international.length < 8 || international.length > 15) {
    return { ok: false, message: 'Die Nummer ist zu kurz oder zu lang.' };
  }

  return { ok: true, phone: `+${international}` };
};

/**
 * Fuer die Anzeige. Regel 43.
 *
 * Gespeichert ist E.164, angezeigt wird die nationale Schreibweise mit Null:
 * `+4915123456789` wird zu `0151 23456789`. Das ist die Form, die im Verein
 * jeder auf seinem Handy sieht — die internationale stimmt zwar auch, sieht
 * aber nach Formular aus.
 *
 * Getrennt wird nach drei Ziffern, also nach der Vorwahl `0151`. Das passt auf
 * jede Mobilnummer, denn deren Vorwahl ist immer dreistellig. Bei einem
 * Festnetzanschluss kann die Trennung daneben liegen — `0231 …` waere richtig,
 * `030 …` wird zu `030 …` nur zufaellig. Die Nummer bleibt dabei vollstaendig
 * und lesbar, und Festnetz kommt hier praktisch nicht vor.
 *
 * Nur die eigene Landesvorwahl wird so umgeschrieben. Eine auslaendische Nummer
 * bleibt international, denn die fuehrende Null gilt dort nicht: aus einer
 * Schweizer Nummer eine mit Null zu machen, waere schlicht falsch.
 */
export const formatPhone = (phone: string): string => {
  const national = new RegExp(`^\\+${DEFAULT_COUNTRY_CODE}(\\d{3})(\\d+)$`).exec(phone);
  if (national) return `0${national[1]} ${national[2]}`;

  // Zwei Ziffern Landesvorwahl deckt Europa ab; alles andere bleibt ungegliedert
  // stehen, statt an der falschen Stelle getrennt zu werden.
  const foreign = /^\+(\d{2})(\d{3})(\d+)$/.exec(phone);
  if (foreign) return `+${foreign[1]} ${foreign[2]} ${foreign[3]}`;

  return phone;
};

/**
 * Fuer Bestaetigungen, ohne die ganze Nummer preiszugeben: "0151 ••• ••89".
 *
 * Baut auf der Anzeigeform auf, damit auch die verdeckte Nummer nach Regel 43
 * aussieht — sonst stuende auf der einen Seite `0151 …` und auf der naechsten
 * `+49151 …`, und man fragte sich, ob das dieselbe Nummer ist.
 */
export const maskPhone = (phone: string): string => {
  if (phone.length < 6) return '•••';
  const shown = formatPhone(phone);
  const head = shown.split(' ')[0] ?? shown;
  return `${head} ••• ••${shown.slice(-2)}`;
};
