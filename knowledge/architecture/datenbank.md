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

# Quittung

Für die [Schiri-Quittung](/capabilities/schiri-quittung.md) kamen drei Tabellen dazu:

- `assignment_expenses`: Fahrtart, Kilometer, Tagegeld, Sonstiges (mit Text) je Einsatz, Schlüssel `(game_id, referee_id)`, zusammengesetzter Fremdschlüssel auf `assignments` mit `ON DELETE CASCADE`. Alle Werte dürfen leer sein.
- `km_rates`: Kilometersätze in Cent, Verlauf über `valid_from`.
- `league_fees`: Spielgebühr je Liga in Cent, Verlauf über `valid_from`; `NULL` heißt geleert. Regeln: [Fahrtkosten und Spielgebühren](/domain/fahrtkosten-und-gebuehren.md).

# Interfaces

Wird ausschließlich über `src/server/` benutzt.

# Related

- [Verarbeitete Daten](/architecture/verarbeitete-daten.md)
