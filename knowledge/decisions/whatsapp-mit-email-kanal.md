---
type: Decision
title: "Nachrichten über die WhatsApp Cloud API, E-Mail als abschaltbarer Kanal"
description: "Nachrichten gehen über die WhatsApp Cloud API von Meta; ein E-Mail-Kanal für Test und Übergang ist per NOTIFICATION_CHANNEL umschaltbar."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:36+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: channel
    resource: ../../src/notifications/channel.ts
---

# Decision

Ziel-Kanal ist die WhatsApp Cloud API von Meta. Daneben gibt es einen E-Mail-Kanal für Tests und den Übergang. Welcher gilt, entscheidet `NOTIFICATION_CHANNEL`; die Fachlogik kennt nur die Kanal-Schnittstelle in `src/notifications/channel.ts`.

# Why

Im Verein liest jeder WhatsApp, kaum jemand liest Vereins-Mails zeitnah. Weil Meta außerhalb des 24-Stunden-Fensters nur freigegebene Vorlagen zulässt, läuft jede Nachricht als Vorlage — siehe [WhatsApp-Vorlagen](/references/whatsapp-vorlagen.md). Der Kanal ist austauschbar, damit sich ohne Meta-Freigabe testen lässt.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Nachrichten sparsam](/domain/nachrichten-sparsamkeit.md)
- [Outbox](/domain/outbox.md)
