import type { Metadata } from 'next';
import { FOOTER_NAV, navForViewer } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { START_PASSWORD_VALID_DAYS } from '@/domain/password';
import { describeHours } from '@/domain/time';
import type { ClubSettings } from '@/domain/types';
import { loadSettings } from '@/server/queries/settings';
import { currentUser } from '@/server/viewer';

/**
 * Die Regularien in Worten.
 *
 * Jede Zahl kommt aus den Einstellungen des Vereins und keine steht
 * abgeschrieben im Text. Vorher stand hier "maximal 10 Erinnerungen", waehrend
 * der Verein laengst 3 eingestellt hatte — eine Regelseite, die etwas anderes
 * behauptet als die Anwendung tut, ist schlimmer als gar keine.
 */

export const metadata: Metadata = {
  title: `Regeln · ${CLUB.appName}`,
  description: 'Eintragen, Austragen, Ersatz und Pflichtbestätigung — kurz und verbindlich.',
};

export const dynamic = 'force-dynamic';

const rulesFor = (settings: ClubSettings): readonly { title: string; body: string }[] => [
  {
    title: 'Eintragen',
    body: 'Zwei gleichwertige Schiedsrichter pro Spiel, dazu zwei Ersatzplätze. Wer zuerst einträgt, hat den Platz — die Eintragung ist sofort verbindlich.',
  },
  {
    title: 'Qualifikation',
    body: 'Eintragen geht nur mit der Qualifikation für die Liga des Spiels. Wer sie erteilt, ist der Admin; ohne sie bleibt der Platz gesperrt, sichtbar ist der Spielplan trotzdem.',
  },
  {
    title: 'Lizenz',
    body: 'Zusätzlich zur Qualifikation zählt die Lizenz. C deckt C-, D- und E-Spiele ab, D deckt D und E, E nur E. Wer keine Lizenz hinterlegt hat, kann sich in kein Spiel eintragen.',
  },
  {
    title: 'Reihenfolge der Plätze',
    body: 'Plätze werden der Reihe nach vergeben: Schiedsrichter 1, dann Schiedsrichter 2, dann Ersatz 1 und Ersatz 2. Ein Ersatzplatz lässt sich erst belegen, wenn beide Schiedsrichter stehen.',
  },
  {
    title: 'Als Ersatz eintragen',
    body: 'Ersatz springt ein, wenn ein Schiedsrichter ausfällt, und wird bei einer Verschiebung wie ein Schiedsrichter benachrichtigt.',
  },
  ...(settings.oneGamePerDay
    ? [
        {
          title: 'Ein Spiel pro Tag',
          body: 'Pro Tag ist ein Spiel vorgesehen; Ersatz-Eintragungen zählen mit. Der Admin kann das für ein einzelnes Spiel freigeben.',
        },
      ]
    : []),
  {
    title: 'Austragen',
    body: `Bis ${settings.withdrawDeadlineDays} Tage vor Anpfiff trägst du dich selbst wieder aus. Danach nur über den Admin — er kann die Frist für ein einzelnes Spiel freigeben.`,
  },
  {
    title: 'Ersatz anfordern',
    body: `Bis ${settings.substituteRequestDeadlineDays} Tage vor Anpfiff kannst du dein Spiel abgeben: der vorderste eingetragene Ersatz wird gefragt, ob er übernimmt. Sagt er zu, tauscht ihr die Plätze. Sagt er ab, ist er aus dem Spiel — offensichtlich kann er an dem Termin nicht — und der nächste Ersatz rückt nach und wird gefragt. Ohne eingetragenen Ersatz geht es nicht; danach ist die Funktion gesperrt, der Admin kann sie freigeben.`,
  },
  {
    title: 'Pflichtbestätigung',
    body: `${describeHours(settings.confirmationLeadHours)} vor Anpfiff kommt eine Nachricht mit dem Knopf „Ja, habe ich gelesen und mache es“. Der Link darin gehört genau zu diesem Spiel. Ohne Antwort innerhalb von ${describeHours(settings.confirmationFollowUpHours)} folgt eine erneute Erinnerung, und die Admins werden informiert.`,
  },
  {
    title: 'Wenn jemand ausfällt',
    body: `Fällt ein Schiedsrichter aus, wird zuerst Ersatz 1 gefragt, ob er nachrückt, danach Ersatz 2 — je ${describeHours(settings.promotionResponseHours)} Zeit zum Antworten. Erst wenn beide ablehnen oder nicht antworten, wird der Platz ausgeschrieben.`,
  },
  {
    title: 'Verschobene Spiele',
    body: 'Schiedsrichter und Ersatz erhalten den neuen Termin mit Absage-Option. Eine Absage öffnet den Platz sofort wieder.',
  },
  {
    title: 'Erinnerungen',
    body: `Du wählst eigene Zeitpunkte zwischen ${describeHours(settings.reminderMaxHours)} und ${describeHours(settings.reminderMinHours)} vor Anpfiff. Ab der ${settings.reminderCostWarningFrom}. fragt die App nach, weil jede Nachricht Geld kostet. Mehr als ${settings.reminderLimit} gehen nicht.`,
  },
  {
    title: 'Statistik',
    body: 'Gezählt werden nur Spiele, die du als Schiedsrichter auf dem Feld gepfiffen hast — Ersatz mit tatsächlichem Einsatz zählt mit, Ersatz ohne Einsatz nicht.',
  },
  {
    title: 'Anmeldung',
    body: `Angemeldet wird mit Telefonnummer und Passwort. Ein neues Konto beginnt mit einem Start-Passwort aus dem Namen; es gilt ${START_PASSWORD_VALID_DAYS} Tage und muss beim ersten Anmelden geändert werden. Vergessene Passwörter setzt ein Admin zurück.`,
  },
  {
    title: 'Sichtbarkeit',
    body: 'Ohne Anmeldung ist nur das Kürzel sichtbar — kein Name, keine Telefonnummer. Name, Kürzel, Telefonnummer, Lizenz und Qualifikationen ändert ausschließlich der Admin.',
  },
];

const Rules = async () => {
  const [user, settings] = await Promise.all([currentUser(), loadSettings()]);
  const { nav, tabs } = navForViewer(user);
  const rules = rulesFor(settings);

  return (
    <Shell
      nav={nav}
      tabs={tabs}
      footerNav={FOOTER_NAV}
      current="/regeln"
      user={user ? { name: user.name, initials: user.initials } : undefined}
    >
      <div className="page-head">
        <div className="page-head-text">
          <div className="kicker kicker-accent">Verbindlich</div>
          <h1>Regeln</h1>
          <p className="lead text-muted">
            Was gilt, wenn du dich einträgst — und was passiert, wenn du wieder absagen musst.
            Die Fristen sind die, die dieser Verein eingestellt hat.
          </p>
        </div>
      </div>

      <div className="definition-grid">
        {rules.map((rule) => (
          <section key={rule.title} className="prose">
            <h3>{rule.title}</h3>
            <p>{rule.body}</p>
          </section>
        ))}
      </div>
    </Shell>
  );
};

export default Rules;
