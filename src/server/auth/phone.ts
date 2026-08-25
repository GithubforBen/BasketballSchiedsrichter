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

  let national: string;
  if (hasPlus) {
    national = digits;
  } else if (digits.startsWith('00')) {
    national = digits.slice(2);
  } else if (digits.startsWith('0')) {
    national = `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  } else {
    return {
      ok: false,
      message: 'Bitte mit Vorwahl angeben, z. B. 0151 23456789 oder +49 151 23456789.',
    };
  }

  if (national.startsWith('0')) {
    return { ok: false, message: 'Nach der Landesvorwahl darf keine Null stehen.' };
  }

  /*
   * "+49 0151 …" ist die haeufigste Fehleingabe: internationale Vorwahl und
   * nationale Null zusammen. Das ergibt stillschweigend eine falsche Nummer,
   * an die dann nie eine Nachricht ankommt. Erkennbar ist das nur fuer die
   * eigene Landesvorwahl — bei fremden Vorwahlen waere dafuer eine Tabelle
   * aller Laendercodes noetig, die dieses Projekt nicht braucht.
   */
  if (national.startsWith(`${DEFAULT_COUNTRY_CODE}0`)) {
    return {
      ok: false,
      message:
        'Entweder mit Ländervorwahl ohne Null (+49 151 …) oder national mit Null (0151 …) — nicht beides.',
    };
  }
  if (national.length < 8 || national.length > 15) {
    return { ok: false, message: 'Die Nummer ist zu kurz oder zu lang.' };
  }

  return { ok: true, phone: `+${national}` };
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
