---
type: Term
title: Outbox
description: "Die Warteschlange, durch die jede Nachricht geht: idempotent je Schlüssel und Empfänger, mit Wortlaut-Protokoll."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: outbox
    resource: ../../src/server/outbox.ts
---

# Meaning

Tabelle `notification_outbox` und `src/server/outbox.ts`: der einzige Weg nach draußen. Jede Nachricht hat einen Idempotenzschlüssel; `(key, recipient_id)` ist eindeutig, Arbeit wird mit `FOR UPDATE SKIP LOCKED` abgeholt, aussichtslose Fehler werden nicht wiederholt. Der Wortlaut jeder versandten Nachricht wird festgehalten (Admin: Nachrichten-Protokoll).

# Not to be confused with

- Nachrichtenplan (`src/domain/scheduler.ts`): entscheidet, *was* fällig ist; die Outbox verschickt.

# Related

- [Nachrichtenversand](/architecture/nachrichtenversand.md)
