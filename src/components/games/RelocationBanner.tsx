import { Button } from '@/components/primitives';
import {
  declineAfterRelocationAction,
  keepAfterRelocationAction,
} from '@/app/spiele/actions';

/**
 * Die Rueckfrage nach einer Verschiebung. Regel 17.
 *
 * Schiedsrichter und Ersatz sehen dieselbe Frage mit derselben Absage-Option —
 * das ist ausdruecklich so gewollt und kein Versehen.
 */

export interface RelocationBannerProps {
  gameId: string;
  day: string;
  title: string;
  detail: string;
  roleLabel: string;
}

export const RelocationBanner = ({
  gameId,
  day,
  title,
  detail,
  roleLabel,
}: RelocationBannerProps) => (
  <section className="banner" aria-labelledby={`verschoben-${gameId}`}>
    <h2
      id={`verschoben-${gameId}`}
      style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '15px', margin: 0 }}
    >
      Spiel verschoben: {title}
    </h2>
    <p style={{ fontSize: '13px', marginTop: 'var(--space-1)' }}>{detail}</p>
    <div className="row">
      <form action={keepAfterRelocationAction}>
        <input type="hidden" name="spiel" value={gameId} />
        <input type="hidden" name="tag" value={day} />
        <Button type="submit" variant="primary">
          Ich bleibe dabei
        </Button>
      </form>
      <form action={declineAfterRelocationAction}>
        <input type="hidden" name="spiel" value={gameId} />
        <input type="hidden" name="tag" value={day} />
        <Button type="submit" variant="secondary">
          Absagen
        </Button>
      </form>
    </div>
    <p className="text-muted" style={{ fontSize: '11px', marginTop: 'var(--space-2)' }}>
      Du bist als {roleLabel} eingetragen. Der Ersatz erhält dieselbe Nachricht mit derselben
      Absage-Option.
    </p>
  </section>
);
