/**
 * Impressum und Datenschutz — die Angaben, die der Verein selbst einträgt.
 *
 * Hier steht ausschliesslich, **wer** die Anwendung betreibt. Was sie mit
 * Daten tut, steht nicht hier, sondern auf der Seite selbst: das ist eine
 * Tatsache ueber den Code und darf sich nicht per Konfiguration abweichend
 * behaupten lassen. Wer die Fristen aendern will, aendert sie in
 * `src/server/aufbewahrung.ts` — die Seite liest sie von dort.
 *
 * Alles, was noch `null` ist, fehlt und wird auf der Seite als Luecke
 * ausgewiesen, statt als Platzhalter zu erscheinen. Ein Impressum mit
 * "[Vorstand]" darin sieht ausgefuellt aus und ist es nicht.
 */

export interface PostalAddress {
  street: string;
  postalCode: string;
  city: string;
}

export interface LegalConfig {
  /** Der Betreiber, wie er im Register steht — mit Rechtsform. */
  operator: string;
  /** Abteilung oder Sparte, falls die Anwendung nur einer gehoert. */
  department: string | null;
  address: PostalAddress;
  /** Vertretungsberechtigte nach § 5 DDG, z. B. der Vorstand. */
  representedBy: string | null;
  email: string | null;
  phone: string | null;
  /** Registergericht und Nummer, z. B. "Amtsgericht Darmstadt · VR 1234". */
  register: string | null;
  /**
   * Wer fuer die Inhalte einsteht. Ohne eigene Redaktion bleibt es `null`.
   *
   * Die Seite nennt dazu keinen Paragraphen. Verlangt ist die **Angabe**, nicht
   * ihre Fundstelle — und ein Zitat, das niemand nachhaelt, wird mit dem
   * naechsten Staatsvertrag falsch. Hier stand einmal der MDStV, ausser Kraft
   * seit 2007.
   */
  contentResponsible: string | null;
  /**
   * Wer Auskunft, Loeschung und Widerspruch entgegennimmt. Ohne eigene
   * Datenschutzbeauftragte ist das der Vorstand — dann bleibt es `null` und
   * die Seite verweist auf das Impressum.
   */
  dataProtectionContact: string | null;
  /**
   * Die Adresse, an die Betroffenenrechte gehen. Steht sie hier, wird sie auf
   * der Seite verlinkt — sonst bleibt nur der Verweis auf das Impressum.
   */
  dataProtectionEmail: string | null;
  /**
   * Die zustaendige Datenschutz-Aufsichtsbehoerde. Sie richtet sich nach dem
   * Sitz des Vereins und ist Teil der Belehrung nach Art. 77 DSGVO — ohne sie
   * weiss niemand, wohin die Beschwerde geht.
   */
  supervisoryAuthority: string | null;
  /**
   * Stand der Datenschutzerklaerung als ISO-Datum. Die Seite formatiert es
   * selbst; ein hier eingetragener Text waere nur eine zweite Schreibweise.
   */
  privacyPolicyDate: string | null;
  /**
   * Ob die Datenschutzerklaerung juristisch geprueft ist. Solange `false`,
   * steht der Entwurfshinweis auf der Seite. Er verschwindet erst, wenn
   * jemand ihn bewusst wegnimmt.
   */
  reviewed: boolean;
}

export const LEGAL: LegalConfig = {
  operator: 'Schulsportclub Bergstraße e.V.',
  department: 'Abteilung Basketball',
  address: { street: 'Pfungstädter Str. 6', postalCode: '64404', city: 'Bickenbach' },
  representedBy: 'Michael Dieter (1. Vorsitzender), Matthias Karch (2. Vorsitzender)',
  email: 'info@sc-bergstrasse.net',
  phone: null,
  register: 'Amtsgericht Darmstadt · VR 1774',
  contentResponsible: 'Linda Schnorrenberger',
  dataProtectionContact: 'Linda Schnorrenberger',
  dataProtectionEmail: 'medienwart.bb.scb@gmail.com',
  supervisoryAuthority:
    'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit, Postfach 3163, 65021 Wiesbaden',
  privacyPolicyDate: '2026-09-25',
  reviewed: true,
};

/** Die Anschrift als Zeilen — leere Felder fallen weg. */
export const addressLines = (address: PostalAddress): readonly string[] =>
  [address.street, [address.postalCode, address.city].filter(Boolean).join(' ')]
    .map((line) => line.trim())
    .filter((line) => line !== '');

/**
 * Was im Impressum noch fehlt, in Worten.
 *
 * § 5 DDG verlangt Anschrift, Vertretung und einen Weg zur schnellen
 * elektronischen Kontaktaufnahme. Fehlt davon etwas, sagt die Seite das
 * deutlich — ein unvollstaendiges Impressum ist abmahnfaehig, und ein
 * stillschweigend leeres faellt niemandem auf.
 */
export const missingLegalFields = (legal: LegalConfig = LEGAL): readonly string[] => {
  const missing: string[] = [];
  if (addressLines(legal.address).length === 0) missing.push('Anschrift');
  if (!legal.representedBy) missing.push('Vertretungsberechtigte');
  if (!legal.email) missing.push('E-Mail-Adresse');
  if (!legal.register) missing.push('Registergericht und -nummer');
  return missing;
};
