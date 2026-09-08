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
 */

export const metadata: Metadata = {
  title: `Impressum & Datenschutz · ${CLUB.appName}`,
  description: 'Betreiber, verarbeitete Daten, Aufbewahrungsfristen und deine Rechte.',
};

export const dynamic = 'force-dynamic';

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
            Verarbeitet werden Name, Vorname, Kürzel, Telefonnummer, Lizenz, Qualifikationen,
            Eintragungen und Einsatzzahlen. Zweck ist die Besetzung der Spiele und die Abrechnung
            der Einsätze. Rechtsgrundlage ist die Mitgliedschaft im Verein.
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

          <h4>Deine Rechte</h4>
          <p>
            Angemeldet lädst du unter „Profil &amp; Erinnerungen“ jederzeit einen vollständigen
            Auszug deiner Daten herunter. Auskunft, Berichtigung, Löschung und Widerspruch nimmt{' '}
            {LEGAL.dataProtectionContact ?? 'ein Admin der Abteilung'} entgegen; die Kontaktdaten
            stehen im Impressum.
          </p>

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
