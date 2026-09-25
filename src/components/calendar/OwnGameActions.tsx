import { Button } from '@/components/primitives';
import {
  requestSubstituteFromCalendarAction,
  withdrawFromCalendarAction,
} from '@/app/kalender/actions';

/**
 * Austragen und Ersatz anfordern — an einem der eigenen Spiele.
 *
 * Was moeglich ist, hat die Regel-Engine entschieden; hier wird nur
 * dargestellt. Wie in "Offene Spiele" gilt: **kein Knopf ist stumm
 * gesperrt.** Ist eine Aktion nicht moeglich, steht der Grund daneben.
 *
 * "Ersatz anfordern" gibt es nur auf einem Schiedsrichter-Platz. Wer selbst
 * auf der Ersatzbank steht, hat niemanden hinter sich, der fuer ihn
 * uebernehmen koennte — ein gesperrter Knopf mit dieser Begruendung waere an
 * jedem Ersatzeinsatz nur Rauschen.
 */

export interface OwnGameAction {
  possible: boolean;
  /** Bei Sperre der Grund, sonst was passieren wird. Leer, wenn es nichts zu sagen gibt. */
  note: string;
}

export interface OwnGameActionsProps {
  gameId: string;
  withdraw: OwnGameAction;
  /** `null` auf einem Ersatzplatz. */
  substituteRequest: OwnGameAction | null;
}

const ActionForm = ({
  gameId,
  action,
  label,
  view,
}: {
  gameId: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
  view: OwnGameAction;
}) => (
  <div className="own-action">
    {view.possible ? (
      <form action={action}>
        <input type="hidden" name="spiel" value={gameId} />
        <Button type="submit" variant="secondary">
          {label}
        </Button>
      </form>
    ) : (
      <Button variant="secondary" disabled>
        {label}
      </Button>
    )}
    {view.note ? <span className="own-action-note">{view.note}</span> : null}
  </div>
);

export const OwnGameActions = ({ gameId, withdraw, substituteRequest }: OwnGameActionsProps) => (
  <div className="own-actions">
    <ActionForm
      gameId={gameId}
      action={withdrawFromCalendarAction}
      label="Austragen"
      view={withdraw}
    />
    {substituteRequest ? (
      <ActionForm
        gameId={gameId}
        action={requestSubstituteFromCalendarAction}
        label="Ersatz anfordern"
        view={substituteRequest}
      />
    ) : null}
  </div>
);
