---
type: Component
title: Regel-Engine (src/domain)
description: "Reine Fachlogik ohne Datenbank: Eintragen, Fristen, Nachrücken, Nachrichtenplan, Statistik, Sichtbarkeit."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: domain
    resource: ../../src/domain/index.ts
---

# Responsibility

`src/domain/` enthält die Regeln aus `PLAN.md` als reine Funktionen ohne Datenbank und Netz: `rules.ts` (eintragen, austragen, Ersatz anfordern), `escalation.ts` (Nachrücken), `confirmation.ts`, `reminders.ts`, `scheduler.ts` (welche Nachrichten jetzt fällig sind), `stats.ts`, `visibility.ts`, `license.ts`, `password.ts`, `phone.ts`, CSV und ICS. Jede Datei hat ihre Tests daneben.

# Interfaces

Wird von `src/server/` aufgerufen, das die Daten liest und Ergebnisse schreibt.

# Related

- [Serverschicht](/architecture/server.md)
