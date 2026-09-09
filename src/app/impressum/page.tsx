import type { Metadata } from 'next';
import { Note } from '@/components/primitives';
import { FOOTER_NAV, navForViewer } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { LEGAL, addressLines, missingLegalFields } from '@/config/legal';
import { START_PASSWORD_VALID_DAYS } from '@/domain/password';
import { DEFAULT_RETENTION } from '@/server/aufbewahrung';
import { currentUser } from '@/server/viewer';

/**
 * Impressum und Datenschutzerklaerung.
 *
 * Wer die Anwendung betreibt, steht in `src/config/legal.ts` — dort traegt der
 * Verein seine Angaben ein. Was die Anwendung mit Daten tut, steht hier im
 * Text: das ist eine Aussage ueber den Code und muss sich mit ihm aendern,
 * nicht per Konfiguration.
 *
 * Die ausfuehrliche Fassung liegt unter `docs/datenschutzerklaerung.md`. Diese
 * Seite ist ihre Kurzfassung und muss dieselben Aussagen treffen — weicht eine
 * von beiden ab, ist es ein Fehler und keine Redaktion.
 */

export const metadata: Metadata = {
  title: `Impressum & Datenschutz · ${CLUB.appName}`,
  description: 'Betreiber, verarbeitete Daten, Aufbewahrungsfristen und deine Rechte.',
};

export const dynamic = 'force-dynamic';

/* Das Datum steht als ISO-Wert in der Konfiguration; geschrieben wird es hier. */
const dateLabel = (iso: string): string =>
  new Intl.DateTimeFormat(CLUB.locale, {
    timeZone: CLUB.timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));

const Legal = async () => {
  const user = await currentUser();
  const { nav, tabs } = navForViewer(user);
  const missing = missingLegalFields();
  const lines = addressLines(LEGAL.address);

  return (
    <Shell
      nav={nav}
      tabs={tabs}
      footerNav={FOOTER_NAV}
      current="/impressum"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <h1>Impressum &amp; Datenschutz</h1>
          <p className="lead text-muted">
            Wer diesen Spielplan betreibt, welche Daten dabei anfallen und wie lange sie bleiben.
          </p>
        </div>
      </div>

      <div className="definition-grid">
        <section className="prose">
          <h3>Impressum</h3>
          <p>
            {LEGAL.operator}
            {LEGAL.department ? (
              <>
                <br />
                {LEGAL.department}
              </>
            ) : null}
            {lines.map((line) => (
              <span key={line}>
                <br />
                {line}
              </span>
            ))}
            {LEGAL.representedBy ? (
              <>
                <br />
                Vertreten durch: {LEGAL.representedBy}
              </>
            ) : null}
            {LEGAL.email ? (
              <>
                <br />
                <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
              </>
            ) : null}
            {LEGAL.phone ? (
              <>
                <br />
                {LEGAL.phone}
              </>
            ) : null}
            {LEGAL.register ? (
              <>
                <br />
                {LEGAL.register}
              </>
            ) : null}
            {LEGAL.contentResponsible ? (
              <>
                <br />
                Inhaltlich verantwortlich nach § 18 Abs. 2 MStV: {LEGAL.contentResponsible}
              </>
            ) : null}
          </p>

          {missing.length > 0 ? (
            <Note>
              Noch einzutragen in <code>src/config/legal.ts</code>: {missing.join(', ')}. Ein
              Impressum ohne diese Angaben genügt § 5 DDG nicht.
            </Note>
          ) : null}
        </section>

        <section className="prose">
          <h3>Datenschutzerklärung</h3>
          <p>
            Die Anwendung dient ausschließlich der vereinsinternen Organisation und Planung von
            Schiedsrichtereinsätzen: Schiedsrichter werden für Spiele eingeteilt, Einsätze
            verwaltet und Erinnerungen sowie organisatorische Nachrichten versandt. Sie wird
            weder öffentlich angeboten noch an andere Vereine weitergegeben.
          </p>

          <h4>Welche Daten</h4>
          <p>
            <strong>Stammdaten:</strong> Name, Vorname, Kürzel, Telefonnummer, Lizenz,
            Qualifikationen für einzelne Ligen, Rolle und Zustand des Kontos.
          </p>
          <p>
            <strong>Einsatzdaten:</strong> Eintragungen auf Schiedsrichter- und Ersatzplätze,
            Zeitpunkt der Eintragung, Bestätigungen, Rückmeldungen zu verlegten Spielen, Name der
            eingeteilten Person, Heim- und Gastmannschaft, Datum, Uhrzeit, Spielort und Liga des
            Spiels sowie die Zuordnung zum jeweiligen Spiel.
          </p>
          <p>
            Zweck ist die Besetzung der Spiele und die Abrechnung der Einsätze. Rechtsgrundlage
            ist Art. 6 Abs. 1 lit. b DSGVO — die Durchführung des Mitgliedschaftsverhältnisses —
            sowie Art. 6 Abs. 1 lit. f DSGVO: Der Verein hat ein berechtigtes Interesse daran,
            den Spielbetrieb zu organisieren, Schiedsrichter einzuteilen, die Durchführung der
            Spiele sicherzustellen und die dafür erforderliche Kommunikation zu ermöglichen.
          </p>
          <p>
            Nachrichten laufen über WhatsApp (Meta Platforms Ireland Ltd.). Dabei wird die
            Telefonnummer an den Dienst übermittelt — ohne sie ist keine Nachricht zustellbar.
            Wer das nicht möchte, sagt einem Admin Bescheid; der Spielplan bleibt auch ohne
            Nachrichten vollständig nutzbar.
          </p>
          <p>
            Öffentlich sichtbar ist ausschließlich das Kürzel. Name und Telefonnummer sind erst
            nach Anmeldung sichtbar und werden ohne Anmeldung nicht ausgeliefert.
          </p>
          <p>
            Angemeldet wird mit Telefonnummer und Passwort. Ein neues Konto beginnt mit einem
            Start-Passwort, das {START_PASSWORD_VALID_DAYS} Tage gilt und beim ersten Anmelden
            geändert werden muss. Passwörter werden ausschließlich als Hash gespeichert.
          </p>
          <p>
            Beim Aufruf dieser Seite werden keine Daten an Dritte übermittelt: Schriften und alle
            weiteren Dateien kommen von diesem Server. Externe Schriftdienste, Analysewerkzeuge
            und Einbettungen gibt es nicht, ebenso wenig Werbe- oder Statistik-Cookies. Gesetzt
            wird allein das Sitzungs-Cookie der Anmeldung.
          </p>

          {/*
            Die Fristen stehen in src/server/aufbewahrung.ts und werden von dort
            gelesen, nicht abgeschrieben. Sonst behauptet die Seite irgendwann
            etwas, das die Anwendung nicht tut.
          */}
          <h4>Aufbewahrung</h4>
          <ul>
            <li>Anmeldeversuche und Sitzungen: {DEFAULT_RETENTION.loginTokensDays} Tage</li>
            <li>Zähler zum Schutz vor Missbrauch: {DEFAULT_RETENTION.rateLimitsDays} Tage</li>
            <li>Versandte Nachrichten: {DEFAULT_RETENTION.outboxDays} Tage</li>
            <li>Protokoll der Admin-Änderungen: {DEFAULT_RETENTION.auditDays} Tage</li>
            <li>
              Stammdaten, Eintragungen und Einsatzzahlen: solange das Konto besteht. Beim Löschen
              des Kontos werden sie vollständig entfernt — auch die vergangenen Einsätze.
            </li>
          </ul>

          <h4>Datensicherheit</h4>
          <p>
            Der Verein trifft angemessene technische und organisatorische Maßnahmen, um die Daten
            vor Verlust, Zerstörung, Manipulation und unberechtigtem Zugriff zu schützen
            (Art. 32 DSGVO). Der Zugang ist auf berechtigte Personen beschränkt und erfolgt über
            persönliche Konten.
          </p>

          <h4>Keine öffentliche Plattform</h4>
          <p>
            Die Anwendung ist ausschließlich für die interne Organisation des Vereins bestimmt.
            Sie bietet keine öffentliche Kommentar- oder Chatfunktion und keine Möglichkeit,
            eigene Inhalte zu veröffentlichen. Nach der derzeitigen Einordnung ist sie damit
            keine öffentliche Online-Plattform im Sinne des Digital Services Act.
          </p>

          <h4>Deine Rechte</h4>
          <p>
            Angemeldet lädst du unter „Profil &amp; Erinnerungen“ jederzeit einen vollständigen
            Auszug deiner Daten herunter. Auskunft, Berichtigung, Löschung, Einschränkung,
            Datenübertragbarkeit und Widerspruch nimmt{' '}
            {LEGAL.dataProtectionContact ?? 'ein Admin der Abteilung'} entgegen
            {LEGAL.dataProtectionEmail ? (
              <>
                {' '}
                (<a href={`mailto:${LEGAL.dataProtectionEmail}`}>{LEGAL.dataProtectionEmail}</a>)
              </>
            ) : null}
            ; die weiteren Kontaktdaten stehen im Impressum.
          </p>

          <h4>Beschwerderecht</h4>
          <p>
            Unabhängig davon steht dir ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde
            zu (Art. 77 DSGVO).
            {LEGAL.supervisoryAuthority ? (
              <> Zuständig ist: {LEGAL.supervisoryAuthority}.</>
            ) : null}
          </p>

          {LEGAL.privacyPolicyDate ? (
            <p className="text-muted">Stand: {dateLabel(LEGAL.privacyPolicyDate)}</p>
          ) : null}

          {LEGAL.reviewed ? null : (
            <Note>
              Entwurf — juristische Prüfung vor dem Echtbetrieb erforderlich. Danach{' '}
              <code>reviewed</code> in <code>src/config/legal.ts</code> auf <code>true</code>{' '}
              setzen.
            </Note>
          )}
        </section>
      </div>
    </Shell>
  );
};

export default Legal;
