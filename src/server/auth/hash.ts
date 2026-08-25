import 'server-only';
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Passwort-Hashing. Regel 39.
 *
 * `scrypt` kommt aus Node selbst — kein zusaetzliches Paket, kein nativer
 * Baustein, der beim naechsten Node-Update bricht. Es ist speicherhart: wer
 * Passwoerter durchprobieren will, braucht je Versuch 32 MB Arbeitsspeicher und
 * nicht nur Rechenzeit. Genau das macht Grafikkarten hier langsam.
 *
 * Gespeichert wird `scrypt$N$r$p$salz$hash`, alles in Base64. Die Parameter
 * stehen mit im Datensatz: werden sie spaeter erhoeht, laesst sich ein alter
 * Hash weiterhin pruefen und beim naechsten Anmelden still erneuern.
 */

/*
 * `promisify` waehlt sonst die Ueberladung ohne Optionen — und ohne Optionen
 * liesse sich weder die Kostenstufe noch die Speichergrenze setzen. Deshalb der
 * ausdrueckliche Typ.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/**
 * Kostenparameter. `N` ist die Speicherhaerte: 2^15 ergibt 128 · N · r Bytes,
 * also 32 MB je Versuch, und braucht auf heutiger Hardware rund 100 ms. Das ist
 * fuer eine Anmeldung nicht spuerbar und fuer einen Angreifer teuer.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 1, keyLength: 64 } as const;

/**
 * Node begrenzt den Speicher fuer scrypt voreingestellt auf genau 32 MB — der
 * Wert oben liegt damit auf der Kante und wuerde je nach Fassung abgelehnt.
 * Deshalb ausdruecklich das Doppelte erlauben.
 */
const MAX_MEMORY = 64 * 1024 * 1024;

const SALT_BYTES = 16;

export const hashPassword = async (plain: string): Promise<string> => {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(plain.normalize('NFC'), salt, PARAMS.keyLength, {
    ...PARAMS,
    maxmem: MAX_MEMORY,
  });

  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
};

/**
 * Prueft ein Passwort gegen einen gespeicherten Hash.
 *
 * Der Vergleich laeuft in gleichbleibender Zeit: ein `===` verriete ueber die
 * Antwortzeit, wie viele Bytes uebereinstimmen.
 *
 * Ist der gespeicherte Wert unlesbar — etwa weil ein Konto noch gar kein
 * Passwort hat —, ist die Antwort `false`, und zwar erst nach einer echten
 * Berechnung. Sonst waere an der Antwortzeit zu erkennen, welche Konten es
 * gibt und welche nicht.
 */
export const verifyPassword = async (plain: string, stored: string): Promise<boolean> => {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    await burnTime();
    return false;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || expected.length === 0) {
    await burnTime();
    return false;
  }

  const derived = await scryptAsync(plain.normalize('NFC'), salt, expected.length, {
    N,
    r,
    p,
    maxmem: MAX_MEMORY,
  });

  return derived.length === expected.length && timingSafeEqual(derived, expected);
};

/**
 * Verbrennt so viel Zeit wie eine echte Pruefung.
 *
 * Wird gebraucht, wenn es nichts zu pruefen gibt: bei einer unbekannten
 * Telefonnummer oder einem Konto ohne Passwort. Ohne das antwortete die
 * Anmeldung in diesen Faellen spuerbar schneller — und waere damit ein
 * Verzeichnis, mit dem sich durchprobieren laesst, wer im Verein pfeift.
 */
export const burnTime = async (): Promise<void> => {
  await scryptAsync('', randomBytes(SALT_BYTES), PARAMS.keyLength, {
    ...PARAMS,
    maxmem: MAX_MEMORY,
  });
};

/** Ein langer, zufaelliger Token fuer den Notzugang. Regel 41. */
export const generateRecoveryToken = (): string =>
  // 48 Byte ergeben 64 Zeichen in Base64url — nicht zu erraten und noch
  // vorlesbar, falls es sein muss.
  randomBytes(48).toString('base64url');
