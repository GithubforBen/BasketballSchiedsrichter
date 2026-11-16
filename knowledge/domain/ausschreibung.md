---
type: Term
title: Ausschreibung
description: "Nachricht über einen offenen Platz an alle Qualifizierten (oder nur die Admins) — die teuerste Nachrichtenart."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: schema
    resource: ../../src/db/schema.ts
---

# Meaning

Die Nachricht `schiriplan_platz_frei` an alle, die für Liga und Lizenz des Spiels in Frage kommen — oder als `schiriplan_platz_frei_admin` nur an die Admins. Gesteuert über `open_slot_visibility` (`all`, `admins`, `off`).

# Not to be confused with

- Notruf: die Ausschreibung von Hand durch den Admin, mit Rückfrage zur Empfängerzahl.

# Related

- [Nachrichten sparsam](/domain/nachrichten-sparsamkeit.md)
