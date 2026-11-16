---
type: Decision
title: PostgreSQL mit Drizzle als ORM
description: "Daten liegen in PostgreSQL; Schema und Abfragen laufen über Drizzle ORM, Migrationen liegen in drizzle/."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:36+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: schema
    resource: ../../src/db/schema.ts
---

# Decision

Die Daten liegen in PostgreSQL. Schema und Abfragen sind mit Drizzle ORM geschrieben (`src/db/schema.ts`), die Migrationen liegen in `drizzle/`.

# Why

Die Kernregeln brauchen echte Transaktionen und Constraints: „wer zuerst einträgt, hat den Platz" ist über einen Unique-Constraint auf `(game_id, slot_index)` abgesichert, und die Outbox holt Arbeit mit `FOR UPDATE SKIP LOCKED`. Integrationstests laufen deshalb gegen ein echtes Postgres, nicht gegen eine Attrappe.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Besetzung](/domain/besetzung.md)
- [Datenbank-Schema](/architecture/datenbank.md)
