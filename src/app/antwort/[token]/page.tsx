import type { Metadata } from 'next';
import { Button, Note } from '@/components/primitives';
import { FOOTER_NAV, PUBLIC_NAV, PUBLIC_TABS } from '@/components/shell/navigation';
import { Shell } from '@/components/shell/Shell';
import { CLUB } from '@/config/club';
import { matchdayLabel, timeLabel } from '@/domain/schedule';
import { describeLeadTime } from '@/domain/time';
import { openAnswer, readAnswer, type AnswerQuestion } from '@/server/answers';
import { answerAction } from './actions';

/**
 * Die Antwortseite eines Nachrichtenlinks.
 *
 * Sie beantwortet genau eine Frage zu genau einem Spiel: der Token in der
 * Adresse sagt, welche. Wer denselben Link ein zweites Mal oeffnet, sieht den
 * aktuellen Stand — „Dieses Spiel hast du bereits bestätigt“ — und nicht noch
 * einmal denselben Knopf.
 *
 * Bewusst ohne Anmeldung: die Nachricht kommt aufs Telefon, und eine
 * Bestaetigung darf nicht an einem vergessenen Passwort scheitern. Der Token
 * oeffnet dafuer auch nichts weiter — nur diese eine Frage, nur bis zum
 * Anpfiff, und er zeigt nur, was ohnehin schon in der Nachricht stand.
 *
 * Geantwortet wird ausschliesslich mit einem Knopf. Ein Aufruf der Adresse
 * aendert nichts: ein vorausschauender Browser oder eine Linkvorschau in
 * WhatsApp darf keine Bestaetigung ausloesen.
 */

export const metadata: Metadata = { title: `Antworten · ${CLUB.appName}` };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

const HEADINGS: Readonly<Record<AnswerQuestion['kind'], string>> = {
  confirm: 'Bestätigst du deinen Einsatz?',
  promotion: 'Rückst du nach?',
  relocation: 'Passt der neue Termin?',
};

/** Ein Knopf, der genau eine Antwort abschickt. */
const Choice = ({
  token,
  choice,
  label,
  variant,
}: {
  token: string;
  choice: string;
  label: string;
  variant: 'primary' | 'secondary';
}) => (
  <form action={answerAction}>
    <input type="hidden" name="token" value={token} />
    <input type="hidden" name="antwort" value={choice} />
    <Button type="submit" variant={variant}>
      {label}
    </Button>
  </form>
);

/** Die Antwortmöglichkeiten, passend zur Frage. */
const Choices = ({ token, kind }: { token: string; kind: AnswerQuestion['kind'] }) => {
  if (kind === 'confirm') {
    return (
      <Choice
        token={token}
        choice="bestaetigen"
        label="Ja, habe ich gelesen und mache es"
        variant="primary"
      />
    );
  }
  if (kind === 'promotion') {
    return (
      <>
        <Choice token={token} choice="nachruecken" label="Ja, ich rücke nach" variant="primary" />
        <Choice token={token} choice="ablehnen" label="Nein, diesmal nicht" variant="secondary" />
      </>
    );
  }
  return (
    <>
      <Choice token={token} choice="bleiben" label="Ich bleibe dabei" variant="primary" />
      <Choice token={token} choice="absagen" label="Ich sage ab" variant="secondary" />
    </>
  );
};

/** Das Spiel, um das es geht — mit Datum *und* Vorlauf, wie in jeder Nachricht. */
const GameFacts = ({ question, now }: { question: AnswerQuestion; now: Date }) => {
  const { game } = question;
  return (
    <dl className="answer-facts">
      <dt>Spiel</dt>
      <dd>
        {game.home} gegen {game.away} ({game.leagueId})
      </dd>
      <dt>Anpfiff</dt>
      <dd>
        {matchdayLabel(game.kickoff, CLUB.timeZone)}, {timeLabel(game.kickoff, CLUB.timeZone)} Uhr
        {' — '}
        {describeLeadTime(game.kickoff, now)}
      </dd>
      <dt>Ort</dt>
      <dd>{game.venue}</dd>
      {question.slotLabel ? (
        <>
          <dt>Dein Platz</dt>
          <dd>{question.slotLabel}</dd>
        </>
      ) : null}
      {question.targetSlotLabel ? (
        <>
          <dt>Frei geworden</dt>
          <dd>{question.targetSlotLabel}</dd>
        </>
      ) : null}
      {question.respondBy && question.state === 'open' ? (
        <>
          <dt>Antwort bis</dt>
          <dd>
            {matchdayLabel(question.respondBy, CLUB.timeZone)},{' '}
            {timeLabel(question.respondBy, CLUB.timeZone)} Uhr
          </dd>
        </>
      ) : null}
    </dl>
  );
};

const Answer = async ({ params, searchParams }: PageProps) => {
  const { token } = await params;
  const query = await searchParams;
  const now = new Date();

  const check = readAnswer(token, now);
  const lookup = check.ok ? await openAnswer(check.claims, now) : null;

  if (!check.ok || !lookup || !lookup.ok) {
    const reason = check.ok ? (lookup && !lookup.ok ? lookup.message : '') : check.message;
    return (
      <Shell nav={PUBLIC_NAV} tabs={PUBLIC_TABS} footerNav={FOOTER_NAV} current="/">
        <div className="form-page">
          <div className="kicker kicker-accent">Aus deiner Nachricht</div>
          <h1>Dieser Link führt nicht weiter</h1>
          <Note>{reason} Melde dich an, dann findest du dein Spiel im Kalender.</Note>
        </div>
      </Shell>
    );
  }

  const { question } = lookup;
  const error = single(query.fehler);
  const hint = single(query.hinweis);

  return (
    <Shell nav={PUBLIC_NAV} tabs={PUBLIC_TABS} footerNav={FOOTER_NAV} current="/">
      <div className="form-page">
        <div className="kicker kicker-accent">Aus deiner Nachricht</div>
        <h1>{HEADINGS[question.kind]}</h1>
        <p className="text-muted" style={{ fontSize: '14px' }}>
          Hallo {question.refereeName}, es geht um genau dieses Spiel:
        </p>

        <GameFacts question={question} now={now} />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        {hint ? <p className="form-success">{hint}</p> : null}

        <Note>{question.status}</Note>

        {question.state === 'open' ? (
          <div
            className="row"
            style={{ gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}
          >
            <Choices token={token} kind={question.kind} />
          </div>
        ) : null}
      </div>
    </Shell>
  );
};

export default Answer;
