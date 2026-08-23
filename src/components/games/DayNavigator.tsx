'use client';

import { useRouter } from 'next/navigation';
import { openGamesRoute } from '@/routes';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

/**
 * Tageswechsel per Wischgeste, Pfeiltasten oder Knopf.
 *
 * Die Wischgeste bewegt den Inhalt sichtbar mit und springt erst ab einer
 * deutlichen Strecke weiter — ein Antippen soll nicht versehentlich den Tag
 * wechseln. Tastaturbedienung ist gleichwertig: der Bereich ist fokussierbar
 * und reagiert auf die Pfeiltasten.
 */

const THRESHOLD_PX = 90;

export interface DayNavigatorProps {
  previousDay: string | null;
  nextDay: string | null;
  children: ReactNode;
}

export const DayNavigator = ({ previousDay, nextDay, children }: DayNavigatorProps) => {
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const startX = useRef<number | null>(null);

  const goTo = (day: string | null) => {
    if (!day) return;
    setOffset(0);
    router.push(openGamesRoute(day));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Nur auf leerem Raum ziehen, nicht auf Knöpfen und Feldern.
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return;
    startX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return;
    const delta = event.clientX - startX.current;
    // Am ersten und letzten Spieltag gibt der Inhalt nur gedämpft nach, damit
    // spürbar wird, dass es dort nicht weitergeht.
    const blocked = (delta > 0 && !previousDay) || (delta < 0 && !nextDay);
    setOffset(blocked ? delta / 4 : delta);
  };

  const onPointerUp = () => {
    if (startX.current === null) return;
    startX.current = null;
    if (offset <= -THRESHOLD_PX && nextDay) goTo(nextDay);
    else if (offset >= THRESHOLD_PX && previousDay) goTo(previousDay);
    else setOffset(0);
  };

  return (
    <div
      className="day-navigator"
      role="group"
      aria-label="Spieltag wechseln"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') goTo(previousDay);
        if (event.key === 'ArrowRight') goTo(nextDay);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ transform: `translateX(${offset}px)` }}
    >
      {children}
    </div>
  );
};
