'use client';

import { useMemo, useState } from 'react';
import { Button, Field, Note, Tag } from '@/components/primitives';
import { formatPhone } from '@/domain/phone';
import {
  REFEREE_CSV_COLUMNS,
  REFEREE_CSV_OPTIONAL_COLUMNS,
  conflictMessage,
  dedupeReferees,
  parseRefereeCsv,
  type ExistingReferees,
} from '@/domain/referee-csv';

/**
 * Schiedsrichter-Import mit einer Vorschau, die mitlaeuft.
 *
 * Wie beim Spielplan rechnet sie im Browser bei jedem Tastendruck, mit
 * denselben reinen Funktionen aus `@/domain`, die auch der Server anwendet.
 * Was hier steht, ist deshalb das, was entsteht — und keine Schaetzung.
 *
 * Beim Anlegen von Konten wiegt das schwerer als beim Spielplan: ein falsch
 * gelesener Spielplan faellt beim naechsten Blick auf; eine Telefonnummer, die
 * still verbogen wurde, faellt erst auf, wenn Nachrichten nie ankommen. Die
 * Vorschau zeigt deshalb jede Nummer so, wie sie gespeichert wuerde.
 */

export interface RefereeCsvImportProps {
  /** Die Server-Aktion, die den Import ausfuehrt. */
  action: (formData: FormData) => Promise<void>;
  /** Ligen des Vereins — eine Zeile mit unbekannter Liga ist unbrauchbar. */
  knownLeagues: readonly string[];
  /** Nummern und Kuerzel, die es schon gibt. */
  existing: ExistingReferees;
  initialText: string;
}

export const RefereeCsvImport = ({
  action,
  knownLeagues,
  existing,
  initialText,
}: RefereeCsvImportProps) => {
  const [text, setText] = useState(initialText);

  const preview = useMemo(() => {
    const parsed = parseRefereeCsv(text, knownLeagues);
    return { ...parsed, ...dedupeReferees(parsed.valid, existing) };
  }, [text, knownLeagues, existing]);

  return (
    <div className="split">
      <form action={action}>
        <Field label="CSV einfügen" htmlFor="csv">
          <textarea
            id="csv"
            name="csv"
            className="input input-mono"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            style={{ width: '100%' }}
          />
        </Field>
        <Note>
          Semikolon getrennt, erste Zeile Kopfzeile. Die Kopfzeile nennt die Spalten — ihre
          Reihenfolge ist egal. Dabei sein müssen {REFEREE_CSV_COLUMNS.join(' und ')};{' '}
          {REFEREE_CSV_OPTIONAL_COLUMNS.join(', ')} sind freiwillig. „Name“ ist der{' '}
          <strong>volle</strong> Name; wer die Liste getrennt führt, nimmt statt dessen
          „Vorname“ und „Nachname“. Bleibt „Kürzel“ leer oder fehlt die Spalte, entsteht es aus
          den Anfangsbuchstaben; bei „Vorname“ gilt dann das erste Wort des Namens. Ligen werden
          mit Komma getrennt. Wessen Nummer schon eingetragen ist, wird übersprungen.
        </Note>
        <Button type="submit" variant="primary">
          Importieren
        </Button>
      </form>

      <aside>
        <h2 className="kicker">Vorschau</h2>
        {preview.fileProblem ? (
          <p className="form-error">{preview.fileProblem}</p>
        ) : (
          <>
            <div className="row" style={{ margin: 'var(--space-3) 0' }}>
              <Tag tone="accent">{preview.fresh.length} neu</Tag>
              <Tag tone="neutral">{preview.duplicates.length} schon da</Tag>
              <Tag tone="outline">
                {preview.invalid.length + preview.conflicts.length} unbrauchbar
              </Tag>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {preview.fresh.map((row) => (
                <li key={`neu-${row.line}`} className="csv-preview-row">
                  <div style={{ fontSize: '13px' }}>
                    {row.name}{' '}
                    <span className="text-muted">
                      {row.initials}
                      {row.initialsFromName ? ' (aus dem Namen)' : ''}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '11px' }}>
                    {row.phone === null ? row.rawPhone : formatPhone(row.phone)} ·{' '}
                    {row.role === 'admin' ? 'Admin' : 'Schiri'} ·{' '}
                    {row.license === null ? 'keine Lizenz' : `Lizenz ${row.license}`} ·{' '}
                    {row.leagueIds.length === 0 ? 'keine Liga' : row.leagueIds.join(', ')}
                  </div>
                </li>
              ))}
              {preview.conflicts.map((row) => (
                <li key={`kuerzel-${row.line}`} className="csv-preview-row csv-preview-row-bad">
                  Zeile {row.line}: {conflictMessage(row)}
                </li>
              ))}
              {preview.invalid.map((row) => (
                <li key={`fehler-${row.line}`} className="csv-preview-row csv-preview-row-bad">
                  Zeile {row.line}: {row.problem}
                </li>
              ))}
            </ul>
            {preview.fresh.some((row) => row.leagueIds.length === 0) ? (
              <Note>
                Ohne Qualifikation kann sich niemand für ein Spiel eintragen (Regel 4). Wer keine
                Liga mitbringt, braucht sie später in der Tabelle.
              </Note>
            ) : null}
          </>
        )}
        <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-3)' }}>
          Die Vorschau rechnet mit, während du tippst. Die Nummern stehen so, wie sie gespeichert
          würden.
        </p>
      </aside>
    </div>
  );
};
