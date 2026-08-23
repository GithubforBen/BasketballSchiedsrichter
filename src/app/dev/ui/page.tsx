import { notFound } from 'next/navigation';
import {
  Button,
  Field,
  Hr,
  Initials,
  Input,
  Note,
  Panel,
  Status,
  TableWrap,
  Tag,
  Toggle,
} from '@/components/primitives';
import { buildSlots } from '@/domain/slots';
import { gameStatus } from '@/domain/status';
import type { Assignment, SlotIndex } from '@/domain/types';

/**
 * Komponenten-Galerie.
 *
 * Zweck ist der Abgleich gegen das Design-System: alles, was die App an
 * Bausteinen kennt, einmal nebeneinander. Nur ausserhalb der Produktion
 * erreichbar — Nutzer sollen hier nicht landen.
 */
export const dynamic = 'force-static';

const slotsFor = (occupants: readonly (string | null)[]) =>
  buildSlots(
    occupants.flatMap((refereeId, index): Assignment[] =>
      refereeId === null
        ? []
        : [
            {
              gameId: 'demo',
              slotIndex: index as SlotIndex,
              refereeId,
              confirmedAt: null,
              claimedAt: new Date(),
              playedAsReferee: null,
            },
          ],
    ),
  );

const STATUS_CASES = [
  { caption: 'kein Schiedsrichter', occupants: [null, null, null, null] },
  { caption: 'ein Schiedsrichter', occupants: ['JK', null, null, null] },
  { caption: 'beide Schiedsrichter, kein Ersatz', occupants: ['JK', 'LB', null, null] },
  { caption: 'alle vier Plätze', occupants: ['JK', 'LB', 'TF', 'AY'] },
] as const;

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section style={{ marginTop: 'var(--space-8)' }}>
    <h2>{title}</h2>
    <Hr />
    {children}
  </section>
);

const UiGallery = () => {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div className="kicker kicker-accent">Nur Entwicklung</div>
      <h1>Bausteine</h1>
      <p className="text-muted" style={{ maxWidth: '58ch' }}>
        Alles, was die Anwendung an Bausteinen kennt. Diese Seite ist der Abgleich gegen das
        Design-System Modernist: keine gerundeten Ecken, Beschriftungen linksbündig, 2px-Linien
        zwischen den Abschnitten, Tastaturfokus als Akzent-Rahmen.
      </p>

      <Section title="Aktionen">
        <div className="row">
          <Button variant="primary">Eintragen</Button>
          <Button variant="secondary">Austragen</Button>
          <Button variant="ghost">Entfernen</Button>
          <Button variant="primary" disabled>
            Gesperrt
          </Button>
        </div>
        <div style={{ maxWidth: '320px', marginTop: 'var(--space-4)' }}>
          <Button variant="primary" block>
            Über die volle Breite, Beschriftung bleibt links
          </Button>
        </div>
      </Section>

      <Section title="Etiketten">
        <div className="row">
          <Tag tone="neutral">U14</Tag>
          <Tag tone="accent">Admin</Tag>
          <Tag tone="outline">offen</Tag>
        </div>
      </Section>

      <Section title="Statusampel">
        <div className="row" style={{ gap: 'var(--space-6)' }}>
          {STATUS_CASES.map((entry) => (
            <div key={entry.caption}>
              <Status view={gameStatus(slotsFor(entry.occupants))} />
              <div className="text-muted" style={{ fontSize: '11px' }}>
                {entry.caption}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Kürzel">
        <div className="row">
          <Initials initials="JK" size={24} label="Jonas Keller" />
          <Initials initials="LB" size={28} label="Lena Brandt" />
          <Initials initials={null} size={28} label="Platz frei" />
          <Initials initials="NB" size={60} label="Nele Baumann" />
        </div>
      </Section>

      <Section title="Formulare">
        <div className="stack" style={{ maxWidth: '420px' }}>
          <Field label="Telefonnummer" htmlFor="demo-phone">
            <Input id="demo-phone" defaultValue="+49 151 23456789" />
          </Field>
          <Field label="Kürzel" htmlFor="demo-initials" hint="Ändert ausschließlich der Admin.">
            <Input id="demo-initials" defaultValue="JK" disabled />
          </Field>
        </div>
      </Section>

      <Section title="Schalter">
        <div className="stack" style={{ maxWidth: '520px' }}>
          <Toggle
            checked
            label="Qualifikation prüfen"
            description="Nur passende Liga kann sich eintragen."
            disabled
            lockedReason="Pflicht — vom Verein nicht abschaltbar."
          />
          <Toggle
            checked
            label="Faire Rotation"
            description="Wer länger nichts hatte, wird zuerst angeschrieben."
          />
          <Toggle checked={false} label="Automatische Nachfrage bei offenen Spielen" />
        </div>
      </Section>

      <Section title="Hinweise">
        <div className="stack" style={{ maxWidth: '640px' }}>
          <Note>Gezählt wird nur, wo du als Schiedsrichter auf dem Feld standst.</Note>
          <Note accent>
            Beim Verschieben erhalten Schiedsrichter und Ersatz eine Nachricht mit dem neuen Termin
            und der Option abzusagen.
          </Note>
        </div>
      </Section>

      <Section title="Flächen">
        <Panel style={{ maxWidth: '320px' }}>
          <div className="kicker kicker-accent">Statistik August 2026</div>
          <div
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: '52px',
              lineHeight: 1,
            }}
          >
            7
          </div>
          <div className="text-muted" style={{ fontSize: '12px' }}>
            gepfiffene Spiele
          </div>
        </Panel>
      </Section>

      <Section title="Tabellen">
        <TableWrap>
          <thead>
            <tr>
              <th>Zeit</th>
              <th>Liga</th>
              <th>Spiel</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {STATUS_CASES.map((entry, index) => (
              <tr key={entry.caption}>
                <td style={{ whiteSpace: 'nowrap' }}>1{index}:30</td>
                <td>
                  <Tag tone="neutral">U14</Tag>
                </td>
                <td>BG Nordstadt — TV Ostheim</td>
                <td>
                  <Status view={gameStatus(slotsFor(entry.occupants))} />
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Section>
    </div>
  );
};

export default UiGallery;
