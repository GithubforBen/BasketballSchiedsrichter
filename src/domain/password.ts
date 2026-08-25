import { days } from './time';

/**
 * Passwoerter — die Regeln, nicht die Kryptografie. Regeln 35-38.
 *
 * Hier steht nur, was ein Passwort fachlich ist: wie das Start-Passwort aus
 * einem Namen folgt, wann es abgelaufen ist und was beim Setzen eines eigenen
 * Passworts gilt. Das Hashen liegt in `@/server/auth/hash` — es braucht
 * Node-Kryptografie und hat in der Regel-Ebene nichts verloren.
 */

/** Regel 36: So lange gilt ein Start-Passwort, danach muss der Admin ran. */
export const START_PASSWORD_VALID_DAYS = 14;

/**
 * Regel 35: das Start-Passwort aus dem Namen.
 *
 * „Anna-Lena Weiss" ergibt `annalenaweiss`. Alles klein, Umlaute
 * ausgeschrieben, alles andere entfaellt — Leerzeichen, Bindestriche,
 * Apostrophe, Titel.
 *
 * Warum ausgeschrieben und nicht mit Umlaut: das Passwort muss auf jeder
 * Tastatur tippbar sein. Wer sein Handy auf Englisch stehen hat, kaeme an ein
 * "oe" heran, an ein "ö" nur ueber Umwege.
 *
 * Es steht nirgends gespeichert. Es folgt aus dem Namen und laesst sich
 * jederzeit neu berechnen — deshalb kann der Adminbereich es anzeigen, ohne
 * dass irgendwo ein Klartext liegt (Regel 39).
 */
export const startPassword = (name: string): string =>
  name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    /*
     * Alles, was nach der Umschrift noch kein a-z ist, faellt weg. Das trifft
     * Leerzeichen und Bindestriche ebenso wie Akzente aus fremden Sprachen —
     * `normalize('NFD')` zerlegt sie vorher in Buchstabe und Zeichen, sodass
     * aus "José" ein "jose" wird und nicht ein "jos".
     */
    .normalize('NFD')
    .replace(/[^a-z]/g, '');

/** Ob ein Name ueberhaupt ein brauchbares Start-Passwort ergibt. */
export const hasUsableStartPassword = (name: string): boolean =>
  startPassword(name).length > 0;

/** Regel 36: Ende der Gueltigkeit, gerechnet ab dem Setzen. */
export const startPasswordExpiry = (setAt: Date): Date =>
  new Date(setAt.getTime() + days(START_PASSWORD_VALID_DAYS));

/**
 * Zustand eines Kontos in Bezug auf sein Passwort.
 *
 * - `start`    Es gilt noch das Start-Passwort; nach dem Anmelden muss geaendert werden.
 * - `expired`  Das Start-Passwort ist abgelaufen; nur ein Admin kommt hier weiter.
 * - `own`      Die Person hat ein eigenes Passwort gesetzt.
 */
export type PasswordState = 'start' | 'expired' | 'own';

export interface PasswordStatus {
  /** Wann die Person zuletzt selbst ein Passwort gesetzt hat. Null = noch nie. */
  ownPasswordSetAt: Date | null;
  /** Ende der Gueltigkeit des Start-Passworts. Null, sobald ein eigenes gilt. */
  startPasswordExpiresAt: Date | null;
}

export const passwordState = (status: PasswordStatus, now: Date): PasswordState => {
  if (status.ownPasswordSetAt !== null) return 'own';
  if (status.startPasswordExpiresAt === null) return 'expired';
  return now.getTime() < status.startPasswordExpiresAt.getTime() ? 'start' : 'expired';
};

/** Regel 37: Solange das Start-Passwort gilt, ist die App gesperrt. */
export const mustChangePassword = (status: PasswordStatus, now: Date): boolean =>
  passwordState(status, now) === 'start';

/**
 * Regel 38: was beim Setzen eines eigenen Passworts gilt.
 *
 * Bewusst **keine** Laengen- oder Zeichenregeln — so entschieden, die Schwaeche
 * ist bekannt. Was bleibt, sind zwei Mechaniken, die keine Regeln im Sinne von
 * Komplexitaet sind:
 *
 *  - Leer geht nicht. Ein leeres Passwort waere kein Passwort.
 *  - Es muss sich vom bisherigen unterscheiden. Sonst koennte man den Zwang aus
 *    Regel 37 erfuellen, indem man dasselbe noch einmal eintippt — die
 *    Aenderung waere Theater.
 */
export type PasswordChange =
  | { readonly ok: true; readonly password: string }
  | { readonly ok: false; readonly message: string };

export const checkNewPassword = (
  candidate: string,
  repeated: string,
  matchesCurrent: boolean,
): PasswordChange => {
  if (candidate === '') {
    return { ok: false, message: 'Bitte gib ein Passwort ein.' };
  }
  if (candidate !== repeated) {
    return { ok: false, message: 'Die beiden Passwörter sind nicht gleich.' };
  }
  if (matchesCurrent) {
    return {
      ok: false,
      message: 'Das ist dein bisheriges Passwort. Bitte denk dir ein anderes aus.',
    };
  }
  return { ok: true, password: candidate };
};
