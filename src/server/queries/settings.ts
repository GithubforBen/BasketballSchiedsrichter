import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { DEFAULT_ALERT_SETTINGS, type AdminAlertSettings } from '@/domain/alerts';
import { DEFAULT_SETTINGS, type ClubSettings } from '@/domain/types';

/**
 * Die vereinsweiten Einstellungen.
 *
 * Es gibt genau eine Zeile. Fehlt sie — etwa vor dem ersten Speichern im
 * Adminbereich — gelten die Voreinstellungen aus der Regel-Engine, damit die
 * Anwendung nicht an einer fehlenden Zeile scheitert.
 */
export const loadSettings = async (): Promise<ClubSettings> => {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_SETTINGS;

  return {
    withdrawDeadlineDays: row.withdrawDeadlineDays,
    substituteRequestDeadlineDays: row.substituteRequestDeadlineDays,
    confirmationLeadHours: row.confirmationLeadHours,
    confirmationFollowUpHours: row.confirmationFollowUpHours,
    reminderLimit: row.reminderLimit,
    reminderCostWarningFrom: row.reminderCostWarningFrom,
    reminderMinHours: row.reminderMinHours,
    reminderMaxHours: row.reminderMaxHours,
    promotionResponseHours: row.promotionResponseHours,
    oneGamePerDay: row.oneGamePerDay,
    rotation: row.rotation,
    rotationWindow: row.rotationWindow,
    autoNudge: row.autoNudge,
  };
};

export const loadAlertSettings = async (): Promise<AdminAlertSettings> => {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.id, 1)).limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_ALERT_SETTINGS;
  return {
    unfilled: row.alertUnfilled,
    confirmationOverdue: row.alertConfirmationOverdue,
    substituteMissing: row.alertSubstituteMissing,
    dailyDigest: row.alertDailyDigest,
  };
};
