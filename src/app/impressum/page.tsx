import type { Metadata } from 'next';
import { Note } from '@/components/primitives';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { DEFAULT_RETENTION } from '@/server/aufbewahrung';
import { currentUser } from '@/server/viewer';

/**
 * Impressum und Datenschutzerklaerung.
 *
 * Die Angaben sind Platzhalter. Der Verein traegt sie ein, die
 * Datenschutzerklaerung braucht vor dem Echtbetrieb eine juristische Pruefung —
 * beides steht als Hinweis auf der Seite, damit es niemand uebersieht.
 */

export const metadata: Metadata = {
  title: `Impressum & Datenschutz · ${CLUB.appName}`,
};

export const dynamic = 'force-dynamic';

const Legal = async () => {
  const user = await currentUser();
  return (
    <Shell
      nav={PUBLIC_NAV}
      tabs={PUBLIC_TABS}
      footerNav={FOOTER_NAV}
      current="/impressum"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <h1>Impressum &amp; Datenschutz</h1>
        </div>
      </div>

      <div className="definition-grid">
        <section>
          <h3>Impressum</h3>
          <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
            {CLUB.name} e.V.
            <br />
            Abteilung Basketball · Jugend
            <br />
            Hallenweg 4, 00000 Nordstadt
            <br />
            Vertreten durch: [Vorstand]
            <br />
            Kontakt: [E-Mail] · [Telefon]
            <br />
            Registergericht: [Amtsgericht] · VR [Nummer]
          </p>
          <Note>Platzhalter — bitte vom Verein ausfüllen.</Note>
        </section>

        <section>
          <h3>Datenschutzerklärung</h3>
          <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
            Verarbeitet werden: Name, Kürzel, Telefonnummer, Profilbild, Qualifikationen,
            Eintragungen und Einsatzzahlen. Zweck ist die Spielplanung und die Abrechnung der
            Einsätze. Nachrichten werden über WhatsApp (Meta Platforms Ireland Ltd.) versendet —
            die Telefonnummer wird dabei an den Dienst übermittelt.
          </p>
          <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
            Öffentlich sichtbar ist ausschließlich das Kürzel. Name, Telefonnummer und Profilbild
            sind erst nach Anmeldung sichtbar und werden nie ohne Anmeldung ausgeliefert.
            Anmeldungen erfolgen über einen Einmal-Link beziehungsweise einen Einmal-Code, die
            nach 15 Minuten verfallen.
          </p>
          <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
            Beim Aufruf dieser Seite werden keine Daten an Dritte übermittelt: Schriften und alle
            weiteren Dateien kommen von diesem Server. Externe Schriftdienste, Analysewerkzeuge
            oder Einbettungen werden nicht verwendet.
          </p>

          {/*
            Die Fristen stehen im Code (src/server/aufbewahrung.ts) und hier —
            beides muss übereinstimmen, sonst behauptet die Seite etwas, das die
            Anwendung nicht tut.
          */}
          <h4 style={{ marginTop: 'var(--space-4)' }}>Aufbewahrung</h4>
          <ul style={{ fontSize: '13px', lineHeight: 1.7 }}>
            <li>Anmeldelinks und -codes: {DEFAULT_RETENTION.loginTokensDays} Tage</li>
            <li>Zähler zum Schutz vor Missbrauch: {DEFAULT_RETENTION.rateLimitsDays} Tage</li>
            <li>Versandte Nachrichten: {DEFAULT_RETENTION.outboxDays} Tage</li>
            <li>Protokoll der Admin-Änderungen: {DEFAULT_RETENTION.auditDays} Tage</li>
            <li>
              Stammdaten, Eintragungen und Einsatzzahlen: solange das Konto besteht. Beim Löschen
              des Kontos werden sie vollständig entfernt — auch die vergangenen Einsätze.
            </li>
          </ul>

          <h4 style={{ marginTop: 'var(--space-4)' }}>Deine Rechte</h4>
          <p style={{ fontSize: '13px', lineHeight: 1.7 }}>
            Angemeldet lädst du unter „Profil“ jederzeit einen vollständigen Auszug deiner Daten
            herunter. Löschung, Berichtigung und Widerspruch nimmt ein Admin der Abteilung
            entgegen; die Kontaktdaten stehen im Impressum.
          </p>
          <Note>Entwurf — juristische Prüfung vor dem Echtbetrieb erforderlich.</Note>
        </section>
      </div>
    </Shell>
  );
};

export default Legal;
