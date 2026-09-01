import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Datenmodell. Ein Verein, deshalb ohne Mandantenschluessel (PLAN.md Abschnitt 1).
 *
 * Zeitstempel liegen als `timestamptz` in UTC; die Vereinszeitzone gilt nur fuer
 * die Anzeige und fuer die Tagesgrenze in Regel 6.
 */

export const leagues = pgTable('leagues', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const referees = pgTable(
  'referees',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /**
     * Vorname, fuer die Anrede in jeder Nachricht.
     *
     * Eigene Spalte und nicht aus `name` abgeleitet: bei "Anna-Lena Mueller"
     * traefe das erste Wort zu, bei "von der Heide Tim" nicht. Der Admin
     * pflegt ihn; beim Anlegen wird das erste Wort des Namens vorgeschlagen.
     */
    firstName: text('first_name').notNull().default(''),
    /** Oeffentlich sichtbares Kuerzel. Regel 29. */
    initials: text('initials').notNull(),
    /**
     * Schiedsrichter-Lizenz. `null` heisst: keine — dann ist keine Eintragung
     * moeglich, auch nicht in eine Liga, fuer die die Qualifikation vorliegt.
     * D deckt D und E ab, E nur E.
     */
    license: text('license', { enum: ['E', 'D'] }),
    /** In E.164, damit der Nachrichtenversand keine Formate raten muss. */
    phone: text('phone').notNull(),
    role: text('role', { enum: ['referee', 'admin'] })
      .notNull()
      .default('referee'),
    avatarUrl: text('avatar_url'),
    active: boolean('active').notNull().default(true),
    /** Persoenliche Erinnerungen als Vorlauf in Stunden. Regel 21. */
    reminderHours: jsonb('reminder_hours').$type<number[]>().notNull().default([]),
    /**
     * Zeitraum der Tagesuebersicht in Wochen, je Admin einstellbar.
     *
     * Sie listet die Spiele, die Aufmerksamkeit brauchen. Ohne Grenze steht am
     * Saisonanfang der halbe Spielplan darin und die Nachricht wird unlesbar;
     * vier Wochen sind der Vorschlag, den jeder Admin fuer sich aendert.
     */
    digestWeeks: integer('digest_weeks').notNull().default(4),
    /** Ob dieser Admin die Tagesuebersicht ueberhaupt bekommt. */
    digestEnabled: boolean('digest_enabled').notNull().default(true),
    /**
     * Passwort, nur als scrypt-Hash. Regel 39 — Klartext ist ueberall verboten.
     * Null heisst: das Konto hat noch gar kein Passwort und kommt nicht rein.
     */
    passwordHash: text('password_hash'),
    /**
     * Wann die Person zuletzt **selbst** ein Passwort gesetzt hat. Null heisst:
     * es gilt noch das Start-Passwort aus dem Namen, und nach der Anmeldung
     * folgt der Aenderungszwang. Regel 37.
     */
    ownPasswordSetAt: timestamp('own_password_set_at', { withTimezone: true }),
    /** Ende der 14-Tage-Frist des Start-Passworts. Regel 36. */
    startPasswordExpiresAt: timestamp('start_password_expires_at', { withTimezone: true }),
    /** Bildschirm, der nach dem Login zuerst geoeffnet wird. */
    lastScreen: text('last_screen'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('referees_phone_key').on(table.phone),
    uniqueIndex('referees_initials_key').on(table.initials),
  ],
);

export const qualifications = pgTable(
  'qualifications',
  {
    refereeId: text('referee_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.refereeId, table.leagueId] })],
);

export const games = pgTable(
  'games',
  {
    id: text('id').primaryKey(),
    /**
     * Auf Sekunden genau. Spiele werden minutengenau angesetzt, und die
     * Duplikaterkennung unten vergleicht diesen Wert: mit der voreingestellten
     * Mikrosekunden-Genauigkeit wuerde ein aus der Datenbank gelesener und
     * erneut geschriebener Zeitstempel nicht mehr auf sich selbst passen,
     * weil JavaScript nur Millisekunden kennt.
     */
    kickoff: timestamp('kickoff', { withTimezone: true, precision: 0 }).notNull(),
    leagueId: text('league_id')
      .notNull()
      .references(() => leagues.id),
    home: text('home').notNull(),
    away: text('away').notNull(),
    venue: text('venue').notNull(),
    /**
     * Lizenz, die zum Pfeifen dieses Spiels noetig ist. E ist die niedrigere,
     * D die hoehere: wer D hat, darf auch E-Spiele pfeifen, umgekehrt nicht.
     */
    requiredLicense: text('required_license', { enum: ['E', 'D'] })
      .notNull()
      .default('E'),
    state: text('state', { enum: ['scheduled', 'moved', 'cancelled'] })
      .notNull()
      .default('scheduled'),
    /** Zaehler fuer Verschiebungen — geht in den Idempotenzschluessel der Nachricht. */
    relocationVersion: integer('relocation_version').notNull().default(0),
    /**
     * Zaehler fuer frei gewordene Schiedsrichter-Plaetze. Steht ebenfalls im
     * Idempotenzschluessel, damit die zweite Ausschreibung eines Spiels nicht
     * als Doppelung der ersten verworfen wird. Regeln 15 und 32.
     */
    vacancyVersion: integer('vacancy_version').notNull().default(0),
    /** Admin-Freigaben pro Spiel. Regeln 6, 7, 8. */
    overrideWithdraw: boolean('override_withdraw').notNull().default(false),
    overrideSubstituteRequest: boolean('override_substitute_request').notNull().default(false),
    overrideOneGamePerDay: boolean('override_one_game_per_day').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('games_kickoff_idx').on(table.kickoff),
    /**
     * Duplikaterkennung fuer den CSV-Import: dasselbe Spiel zur selben Zeit
     * zwischen denselben Mannschaften gibt es nur einmal.
     */
    uniqueIndex('games_natural_key').on(table.kickoff, table.home, table.away),
  ],
);

export const assignments = pgTable(
  'assignments',
  {
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    /** 0 und 1 sind Schiedsrichter, 2 und 3 Ersatz. Regel 1. */
    slotIndex: smallint('slot_index').notNull(),
    /*
     * Loeschen nimmt die Eintragungen mit. Das ist der Kern des Loeschkonzepts:
     * wer geloescht wird, verschwindet auch aus Statistik und Verlauf — sonst
     * bliebe seine Spur genau dort, wo sie am aussagekraeftigsten ist. Fuer den
     * haeufigeren Fall, dass jemand nur aufhoert und die Zahlen bleiben sollen,
     * gibt es das Stilllegen (PLAN.md Abschnitt 4, M6).
     */
    refereeId: text('referee_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    /** Pflichtbestaetigung. Regeln 10-12. */
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    /** Tatsaechlicher Einsatz. null = noch nicht entschieden. Regeln 25-27. */
    playedAsReferee: boolean('played_as_referee'),
    /**
     * Bis zu welcher Verschiebung diese Person zugesagt hat. Regel 17.
     * Liegt der Zaehler des Spiels darueber, steht die Rueckmeldung noch aus
     * und das Banner erscheint. So bleibt die Frage auch nach einem Neuladen
     * gestellt und verschwindet nicht in einem fluechtigen Zustand.
     */
    acknowledgedRelocation: integer('acknowledged_relocation').notNull().default(0),
  },
  (table) => [
    /**
     * Der Kern von First come, first served: zwei gleichzeitige Eintragungen
     * auf denselben Platz koennen nicht beide gewinnen. Regel 3.
     */
    primaryKey({ columns: [table.gameId, table.slotIndex] }),
    /** Regel 5: niemand belegt zwei Plaetze im selben Spiel. */
    uniqueIndex('assignments_one_slot_per_referee').on(table.gameId, table.refereeId),
  ],
);

/** Laufende Nachrueck-Anfragen. Regeln 13-15. */
export const promotionOffers = pgTable(
  'promotion_offers',
  {
    id: text('id').primaryKey(),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id, { onDelete: 'cascade' }),
    targetSlot: smallint('target_slot').notNull(),
    substituteSlot: smallint('substitute_slot').notNull(),
    refereeId: text('referee_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    respondBy: timestamp('respond_by', { withTimezone: true }).notNull(),
    outcome: text('outcome', { enum: ['pending', 'accepted', 'declined', 'expired'] })
      .notNull()
      .default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('promotion_offers_game_idx').on(table.gameId)],
);

/** Anmeldung per Magic-Link und Code. Beide Wege teilen sich einen Datensatz. */
export const loginTokens = pgTable(
  'login_tokens',
  {
    id: text('id').primaryKey(),
    refereeId: text('referee_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    /** Nur Hashes, nie der Klartext — der steht ausschliesslich in der Nachricht. */
    linkTokenHash: text('link_token_hash').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('login_tokens_referee_idx').on(table.refereeId)],
);

/**
 * Ausgehende Nachrichten. Regel 33: jede Zeile ist eine bezahlte Nachricht,
 * `costUnits` macht die Kosten auswertbar. `key` verhindert Doppelversand.
 */
export const notificationOutbox = pgTable(
  'notification_outbox',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    kind: text('kind').notNull(),
    channel: text('channel', { enum: ['whatsapp', 'email', 'dev'] }).notNull(),
    recipientId: text('recipient_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    gameId: text('game_id').references(() => games.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    costUnits: integer('cost_units').notNull().default(1),
    /**
     * `sending` ist der Zustand zwischen Holen und Ergebnis.
     *
     * Ohne ihn koennten zwei gleichzeitige Cron-Laeufe dieselbe Zeile greifen
     * und die Nachricht ginge doppelt raus. Wer holt, setzt zugleich
     * `sendAfter` in die Zukunft: stuerzt der Prozess mitten im Versand ab,
     * wird die Zeile nach dieser Frist von allein wieder abholbar, statt fuer
     * immer in `sending` zu haengen.
     */
    state: text('state', { enum: ['queued', 'sending', 'sent', 'failed'] })
      .notNull()
      .default('queued'),
    attempts: integer('attempts').notNull().default(0),
    sendAfter: timestamp('send_after', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    lastError: text('last_error'),
  },
  (table) => [
    uniqueIndex('notification_outbox_key').on(table.key, table.recipientId),
    index('notification_outbox_due_idx').on(table.state, table.sendAfter),
  ],
);

/**
 * Notzugang fuer ausgesperrte Admins. Regel 41.
 *
 * Der Token entsteht auf dem Server, wird genau einmal angezeigt und liegt hier
 * nur als Hash — wie ein Passwort. Er gilt einmal; wer ihn einloest, landet
 * sofort im Aenderungszwang und setzt ein neues Passwort.
 */
export const adminRecoveryTokens = pgTable(
  'admin_recovery_tokens',
  {
    id: text('id').primaryKey(),
    refereeId: text('referee_id')
      .notNull()
      .references(() => referees.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    /** Freitext des Ausstellers, damit mehrere Token unterscheidbar bleiben. */
    label: text('label').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('admin_recovery_referee_idx').on(table.refereeId)],
);

/** Vereinsweite Einstellungen als einzelne Zeile — es gibt genau einen Verein. */
export const settings = pgTable('settings', {
  id: smallint('id').primaryKey().default(1),
  withdrawDeadlineDays: integer('withdraw_deadline_days').notNull().default(21),
  substituteRequestDeadlineDays: integer('substitute_request_deadline_days').notNull().default(3),
  confirmationLeadHours: integer('confirmation_lead_hours').notNull().default(72),
  confirmationFollowUpHours: integer('confirmation_follow_up_hours').notNull().default(24),
  reminderLimit: integer('reminder_limit').notNull().default(10),
  reminderCostWarningFrom: integer('reminder_cost_warning_from').notNull().default(4),
  reminderMinHours: integer('reminder_min_hours').notNull().default(1),
  reminderMaxHours: integer('reminder_max_hours').notNull().default(168),
  promotionResponseHours: integer('promotion_response_hours').notNull().default(12),
  oneGamePerDay: boolean('one_game_per_day').notNull().default(true),
  rotation: boolean('rotation').notNull().default(true),
  rotationWindow: text('rotation_window', { enum: ['week', 'month', 'season'] })
    .notNull()
    .default('week'),
  autoNudge: boolean('auto_nudge').notNull().default(true),
  /**
   * Wer die Ausschreibung eines offenen Platzes bekommt. Regeln 15 und 32.
   * Sie ist die einzige Nachricht an viele Personen auf einmal — deshalb ist
   * sie ganz abschaltbar und nicht nur in ihren Wiederholungen.
   */
  openSlotVisibility: text('open_slot_visibility', { enum: ['all', 'admins', 'off'] })
    .notNull()
    .default('all'),
  /** Ob die Quittung nach dem Eintragen rausgeht. Regel 31. */
  assignmentReceipt: boolean('assignment_receipt').notNull().default(true),
  alertUnfilled: boolean('alert_unfilled').notNull().default(true),
  alertConfirmationOverdue: boolean('alert_confirmation_overdue').notNull().default(true),
  alertSubstituteMissing: boolean('alert_substitute_missing').notNull().default(true),
  alertCancellation: boolean('alert_cancellation').notNull().default(true),
  alertDailyDigest: boolean('alert_daily_digest').notNull().default(true),
  alertAfterImport: boolean('alert_after_import').notNull().default(false),
});

/** Wer hat was geaendert. Jede Admin-Aktion landet hier. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => referees.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    gameId: text('game_id').references(() => games.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id'),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_created_idx').on(table.createdAt)],
);

/**
 * Zaehler fuer Rate-Limits, in festen Zeitfenstern.
 *
 * Bewusst in der Datenbank und nicht im Arbeitsspeicher: ein Neustart darf das
 * Limit nicht zuruecksetzen, und bei mehreren Prozessen muesste es sonst
 * mehrfach ueberschritten werden koennen.
 */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').notNull(),
    windowStart: timestamp('window_start', { withTimezone: true, precision: 0 }).notNull(),
    count: integer('count').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.key, table.windowStart] })],
);
