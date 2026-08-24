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

/** Fuer die Anzeige: "+49 151 23456789" statt "+4915123456789". */
export const formatPhone = (phone: string): string => {
  const match = /^\+(\d{2})(\d{3})(\d+)$/.exec(phone);
  if (!match) return phone;
  return `+${match[1]} ${match[2]} ${match[3]}`;
};

/** Fuer Bestaetigungen, ohne die ganze Nummer preiszugeben: "+49 151 ••• ••89". */
export const maskPhone = (phone: string): string => {
  if (phone.length < 6) return '•••';
  const head = phone.slice(0, 6);
  const tail = phone.slice(-2);
  return `${head} ••• ••${tail}`;
};
