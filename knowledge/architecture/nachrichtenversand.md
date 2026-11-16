---
type: Component
title: Nachrichtenversand (src/notifications)
description: Vorlagen-Texte, Kanal-Schnittstelle (WhatsApp oder E-Mail) und Antwortlinks.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: templates
    resource: ../../src/notifications/templates.ts
  - id: channel
    resource: ../../src/notifications/channel.ts
---

# Responsibility

`src/notifications/` macht aus einer Nachrichtenabsicht den Versand: `templates.ts` hält die Texte der WhatsApp-Vorlagen mit `{{1}}`-Platzhaltern und erzeugt daraus Vorlagen-Aufruf und Fließtext, `channel.ts` ist die Kanal-Schnittstelle (`NOTIFICATION_CHANNEL`), `action-links.ts` signiert die Antwortlinks.

# Interfaces

Die Outbox (`src/server/outbox.ts`) ruft den Kanal; `/dev/outbox` zeigt in der Entwicklung, was genau so rausgehen würde.

# Related

- [Outbox](/domain/outbox.md)
- [WhatsApp-Vorlagen](/references/whatsapp-vorlagen.md)
