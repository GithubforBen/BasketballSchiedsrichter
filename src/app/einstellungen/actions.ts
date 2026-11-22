"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { OpenSlotVisibility, RotationWindow } from "@/domain/types";
import { adminResultRoute } from "@/routes";
import { saveSettings, setLeague } from "@/server/admin/settings";
import { requireAdmin } from "@/server/guard";
import { saveKmRates, saveLeagueFee } from "@/server/receipt-rates";

/** Vereinsweite Einstellungen und Ligen. */

const read = (formData: FormData, key: string): string => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const number = (formData: FormData, key: string): number =>
  Number.parseInt(read(formData, key), 10);

const checked = (formData: FormData, key: string): boolean =>
  formData.get(key) === "an";

export const saveSettingsAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const window = read(formData, "rotationszeitraum");
  const openSlot = read(formData, "ausschreibung");

  const result = await saveSettings(user.id, {
    withdrawDeadlineDays: number(formData, "austragefrist"),
    substituteRequestDeadlineDays: number(formData, "ersatzfrist"),
    confirmationLeadHours: number(formData, "bestaetigungsvorlauf"),
    reminderLimit: number(formData, "erinnerungslimit"),
    oneGamePerDay: checked(formData, "einSpielProTag"),
    rotation: checked(formData, "rotation"),
    rotationWindow: (["week", "month", "season"] as const).includes(
      window as RotationWindow,
    )
      ? (window as RotationWindow)
      : "week",
    autoNudge: checked(formData, "autoNachfrage"),
    openSlotVisibility: (["all", "admins", "off"] as const).includes(
      openSlot as OpenSlotVisibility,
    )
      ? (openSlot as OpenSlotVisibility)
      : "all",
    assignmentReceipt: checked(formData, "quittungEintragung"),
    /*
     * Die vier Spalten ohne eigenen Schalter bleiben stehen, wie sie sind.
     * Sie steuerten entweder nie eine Nachricht oder in Wahrheit nur die
     * Meldungsliste auf dem Bildschirm — und die haengt jetzt an nichts mehr.
     * Sie hier mit `false` zu ueberschreiben, weil im Formular kein Haekchen
     * mehr steht, waere die stille Variante desselben Fehlers.
     */
    alertConfirmationOverdue: checked(formData, "meldungBestaetigung"),
    alertDailyDigest: checked(formData, "meldungTaeglich"),
  });

  revalidatePath("/einstellungen");
  redirect(adminResultRoute("/einstellungen", result));
};

export const setLeagueAction = async (formData: FormData): Promise<void> => {
  const user = await requireAdmin();
  const result = await setLeague(
    user.id,
    read(formData, "liga"),
    read(formData, "wert") === "an",
  );
  revalidatePath("/einstellungen");
  redirect(adminResultRoute("/einstellungen", result));
};

const EURO = /^\d+(?:[.,]\d{1,2})?$/;

/** "0,30" -> 30 Cent; leer -> null; sonst `undefined`. */
const parseCents = (raw: string): number | null | undefined => {
  const value = raw.trim();
  if (value === "") return null;
  if (!EURO.test(value)) return undefined;
  return Math.round(Number(value.replace(",", ".")) * 100);
};

/** Die beiden Kilometersaetze der Quittung (Euro je km). */
export const saveKmRatesAction = async (formData: FormData): Promise<void> => {
  await requireAdmin();
  const solo = parseCents(read(formData, "satzAllein"));
  const shared = parseCents(read(formData, "satzMitfahrer"));
  if (solo == null || shared == null) {
    redirect(
      adminResultRoute("/einstellungen", {
        ok: false,
        message:
          "Beide Kilometersätze bitte als Betrag in Euro angeben, z. B. 0,30.",
      }),
    );
  }
  const result = await saveKmRates({ soloCents: solo, sharedCents: shared });
  revalidatePath("/einstellungen");
  redirect(
    adminResultRoute(
      "/einstellungen",
      result.ok
        ? {
            ok: true,
            message: result.changed
              ? "Kilometersätze gespeichert. Sie gelten für Spiele ab jetzt."
              : "Die Kilometersätze waren schon so eingestellt.",
          }
        : result,
    ),
  );
};

/** Die Gebuehr einer Liga (Euro); leer entfernt sie. */
export const saveLeagueFeeAction = async (
  formData: FormData,
): Promise<void> => {
  await requireAdmin();
  const league = read(formData, "liga");
  const fee = parseCents(read(formData, "gebuehr"));
  if (fee === undefined) {
    redirect(
      adminResultRoute("/einstellungen", {
        ok: false,
        message: "Die Gebühr bitte als Betrag in Euro angeben, z. B. 20,00.",
      }),
    );
  }
  const result = await saveLeagueFee(league, fee);
  revalidatePath("/einstellungen");
  redirect(
    adminResultRoute(
      "/einstellungen",
      result.ok
        ? {
            ok: true,
            message: result.changed
              ? `Gebühr für ${league} gespeichert. Sie gilt für Spiele ab jetzt.`
              : `Die Gebühr für ${league} war schon so eingestellt.`,
          }
        : result,
    ),
  );
};
