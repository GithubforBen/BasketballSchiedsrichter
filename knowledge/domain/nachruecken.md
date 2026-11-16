---
type: Term
title: "Nachrücken"
description: "Ein Ersatz übernimmt einen frei gewordenen Schiedsrichterplatz, nach Anfrage mit Frist (promotion offer)."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: escalation
    resource: ../../src/domain/escalation.ts
---

# Meaning

Ein Ersatz wechselt auf einen frei gewordenen Schiedsrichterplatz. Er wird dazu einzeln angefragt (`promotion_offers`, Nachricht `schiriplan_nachruecken`) und hat eine Antwortfrist. Im Code `promotion`.

# Not to be confused with

- Eintragen: das ist freiwillig und sofort; Nachrücken geschieht auf Anfrage.

# Related

- [Ausfall und Nachrücken](/domain/ausfall-und-nachruecken.md)
