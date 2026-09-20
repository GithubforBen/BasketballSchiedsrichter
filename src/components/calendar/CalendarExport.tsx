'use client';

import { useState } from 'react';
import { Button } from '@/components/primitives';
import { CALENDAR_EXPORT_PATH, CALENDAR_GAME_PARAM } from '@/routes';

/**
 * Die Auswahl fuer die Kalenderdatei.
 *
 * Ein gewoehnliches GET-Formular: abgeschickt wird es zu einer Adresse mit
 * einem `spiel=` je Haken, und die Antwort ist die Datei. Ohne JavaScript
 * funktioniert es deshalb weiterhin — nur die beiden Knoepfe „alle
 * auswaehlen“ und „keines“ brauchen es, und die sind Bequemlichkeit und nicht
 * Voraussetzung.
 *
 * Voreingestellt sind die Spiele, in denen man selbst pfeift. Der Ersatz
 * steht mit in der Liste, aber ohne Haken: dort haelt man sich bereit, und ob
 * das als Termin in den eigenen Kalender gehoert, entscheidet jeder selbst
 * (Regel 12).
 */

export interface CalendarExportGame {
  id: string;
  /** „Sa 26.09.2026, 14:00 Uhr“ */
  when: string;
  /** „BG Nordstadt — TV Ostheim“ */
  title: string;
  /** „Schiedsrichter 1 · Sporthalle Nordstadt“ */
  detail: string;
  /** Ob der Haken von Anfang an sitzt: wahr fuer Schiri 1 und Schiri 2. */
  preselected: boolean;
}

export interface CalendarExportProps {
  games: readonly CalendarExportGame[];
}

export const CalendarExport = ({ games }: CalendarExportProps) => {
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(games.filter((game) => game.preselected).map((game) => game.id)),
  );

  const toggle = (id: string): void =>
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const count = chosen.size;

  return (
    <form action={CALENDAR_EXPORT_PATH} method="get" className="stack">
      <div className="row" style={{ gap: 'var(--space-2)' }}>
        <Button
          variant="ghost"
          className="btn-compact"
          onClick={() => setChosen(new Set(games.map((game) => game.id)))}
        >
          Alle wählen
        </Button>
        <Button
          variant="ghost"
          className="btn-compact"
          onClick={() => setChosen(new Set())}
        >
          Alle abwählen
        </Button>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          {count} von {games.length} gewählt
        </span>
      </div>

      <ul className="card-list" style={{ margin: 0 }}>
        {games.map((game) => (
          <li key={game.id} className="game-card">
            <label
              className="row"
              style={{ alignItems: 'flex-start', gap: 'var(--space-3)', flex: 1, margin: 0 }}
            >
              <input
                type="checkbox"
                name={CALENDAR_GAME_PARAM}
                value={game.id}
                checked={chosen.has(game.id)}
                onChange={() => toggle(game.id)}
                className="check-inline"
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="game-card-title">{game.title}</span>
                <span
                  className="text-muted"
                  style={{ display: 'block', fontSize: '11px' }}
                >
                  {game.when}
                </span>
                <span
                  className="text-muted"
                  style={{ display: 'block', fontSize: '11px' }}
                >
                  {game.detail}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="row">
        {/*
          * Gesperrt, solange nichts gewaehlt ist: eine Kalenderdatei ohne
          * einen einzigen Termin ist zwar gueltig, aber niemand will sie —
          * und wer sie bekaeme, suchte den Fehler bei sich.
          */}
        <Button type="submit" variant="primary" disabled={count === 0}>
          {count === 0
            ? 'Kein Spiel gewählt'
            : count === 1
              ? '1 Spiel herunterladen'
              : `${count} Spiele herunterladen`}
        </Button>
        <span className="text-muted" style={{ fontSize: '11px', flex: 1, minWidth: '200px' }}>
          Die Datei (.ics) lässt sich in Google Kalender und Apple Kalender importieren. Lädst du
          sie später erneut, ersetzt sie die alten Termine, statt sie zu verdoppeln.
        </span>
      </div>
    </form>
  );
};
