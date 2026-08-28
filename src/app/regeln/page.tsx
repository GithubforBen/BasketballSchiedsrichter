import type { Metadata } from 'next';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { currentUser } from '@/server/viewer';

/**
 * Die Regularien in Worten.
 *
 * Der Wortlaut stammt aus dem Mockup und beschreibt genau die Regeln, die die
 * Anwendung durchsetzt. Aendert sich eine Regel im Code, gehoert sie hier
 * angepasst — sonst widerspricht die Erklaerung dem Verhalten.
 */

export const metadata: Metadata = {
  title: `Regeln · ${CLUB.appName}`,
  description: 'Eintragen, Austragen, Ersatz und Pflichtbestätigung — kurz und verbindlich.',
};

export const dynamic = 'force-dynamic';

const RULES: readonly { title: string; body: string }[] = [
  {
    title: 'Eintragen',
    body: 'Zwei gleichwertige Schiedsrichter pro Spiel. Wer zuerst einträgt, hat den Platz — die Eintragung ist sofort verbindlich. Eintragen geht nur mit passender Qualifikation für die Liga.',
  },
  {
    title: 'Reihenfolge der Plätze',
    body: 'Plätze werden der Reihe nach vergeben: Schiedsrichter 1, dann Schiedsrichter 2, dann Ersatz 1 und Ersatz 2. Ein Ersatzplatz lässt sich also erst belegen, wenn beide Schiedsrichter stehen.',
  },
  {
    title: 'Als Ersatz eintragen',
    body: 'Zwei Ersatzplätze pro Spiel. Ersatz springt ein, wenn ein Schiedsrichter ausfällt, und wird bei einer Verschiebung wie ein Schiedsrichter benachrichtigt.',
  },
  {
    title: 'Ein Spiel pro Tag',
    body: 'Pro Tag ist ein Spiel vorgesehen; Ersatz-Eintragungen zählen mit. Der Admin kann das für ein einzelnes Spiel freigeben.',
  },
  {
    title: 'Austragen',
    body: 'Bis 3 Wochen vor Anpfiff kannst du dich selbst wieder austragen. Danach nur über den Admin — er kann die Frist pro Spiel freigeben.',
  },
  {
    title: 'Ersatz anfordern',
    body: 'Bis 3 Tage vor Anpfiff kannst du Ersatz anfordern; alle Qualifizierten erhalten eine Nachricht. Danach ist die Funktion gesperrt, der Admin kann sie freigeben.',
  },
  {
    title: 'Pflichtbestätigung',
    body: 'Vor jedem Spiel kommt eine Nachricht mit dem Knopf „Ja, habe ich gelesen und mache es“. Der Link darin gehört genau zu diesem Spiel — du bestätigst damit kein anderes, und beim zweiten Öffnen steht dort, dass es schon bestätigt ist. Ohne Antwort innerhalb von 24 Stunden folgt eine erneute Erinnerung, zusätzlich wird der Admin informiert.',
  },
  {
    title: 'Wenn jemand ausfällt',
    body: 'Fällt ein Schiedsrichter aus, wird zuerst Ersatz 1 gefragt, ob er nachrückt, danach Ersatz 2. Erst wenn beide ablehnen oder nicht antworten, wird der Platz ausgeschrieben — je nach Vereinseinstellung an alle Qualifizierten oder nur an die Admins.',
  },
  {
    title: 'Verschobene Spiele',
    body: 'Schiedsrichter und Ersatz erhalten den neuen Termin mit Absage-Option. Eine Absage öffnet den Platz sofort wieder.',
  },
  {
    title: 'Erinnerungen',
    body: 'Du wählst eigene Zeitpunkte zwischen 7 Tagen und 1 Stunde vor Anpfiff. Ab der vierten Erinnerung fragt die App nach, weil jede Nachricht Geld kostet. Maximal 10 pro Person.',
  },
  {
    title: 'Statistik',
    body: 'Gezählt werden nur Spiele, die du als Schiedsrichter gepfiffen hast — inklusive Ersatz mit tatsächlichem Einsatz. Ersatz ohne Einsatz zählt nicht.',
  },
  {
    title: 'Sichtbarkeit',
    body: 'Ohne Anmeldung ist nur das Kürzel sichtbar — kein Name, keine Telefonnummer, kein Profilbild. Name, Kürzel und Telefonnummer ändert ausschließlich der Admin.',
  },
];

const Rules = async () => {
  const user = await currentUser();
  return (
    <Shell
      nav={PUBLIC_NAV}
      tabs={PUBLIC_TABS}
      footerNav={FOOTER_NAV}
      current="/regeln"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Verbindlich</div>
          <h1>Regeln</h1>
          <p className="text-muted">
            Kurz und verbindlich — die Regularien für Eintragen, Austragen, Ersatz und Bestätigung.
          </p>
        </div>
      </div>

      <div className="definition-grid">
        {RULES.map((rule) => (
          <section key={rule.title}>
            <h3>{rule.title}</h3>
            <p style={{ fontSize: '13px' }}>{rule.body}</p>
          </section>
        ))}
      </div>
    </Shell>
  );
};

export default Rules;
