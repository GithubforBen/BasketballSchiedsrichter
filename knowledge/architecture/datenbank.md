---
type: Component
title: Datenbank-Schema (src/db, drizzle/)
description: "Drizzle-Schema, Migrationen und Seeds: Schiedsrichter, Spiele, Plätze, Outbox, Einstellungen, Prüfprotokoll."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: schema
    resource: ../../src/db/schema.ts
---

# Responsibility

`src/db/schema.ts` definiert alle Tabellen; `drizzle/` hält die Migrationen (`npm run db:migrate`). `seed.ts` spielt Beispieldaten ein, `seed-admin.ts` legt den ersten Admin an. Constraints tragen Fachregeln, z. B. ein Platz je Spiel nur einmal.

# Interfaces

Wird ausschließlich über `src/server/` benutzt.

# Related

- [Verarbeitete Daten](/architecture/verarbeitete-daten.md)
