---
type: Component
title: Serverschicht (src/server)
description: "Liest und schreibt die Datenbank, ruft die Regel-Engine, führt Admin-Aktionen, Anmeldung, Outbox, Aufbewahrung und Auskunft aus."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: server
    resource: ../../src/server/guard.ts
---

# Responsibility

`src/server/` verbindet Regel-Engine und Datenbank: Abfragen (`queries/`), Admin-Aktionen (`admin/`), Anmeldung und Sitzungen (`auth/`, `session.ts`), Eintragen (`assignments.ts`), Antworten auf Links (`answers.ts`), Nachrichtenlauf (`scheduler.ts`, `outbox.ts`), Rate-Limits, Löschfristen (`aufbewahrung.ts`) und Datenauszug (`auskunft.ts`).

# Interfaces

Wird von Seiten und Serveraktionen in `src/app/` aufgerufen.

# Related

- [Regel-Engine](/architecture/regel-engine.md)
- [Datenbank-Schema](/architecture/datenbank.md)
