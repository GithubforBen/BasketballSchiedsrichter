---
type: Backlog Item
title: "Prüfen, ob termin_geaendert und erinnerung bei Meta freigegeben sind"
description: "Ungeklärt: Laut TODO.md (Stand 7.9.) fehlten zwei Vorlagen bei Meta, die der Code für Verschiebungen und Erinnerungen weiter verschickt."
status: draft
state: open
priority: medium
origin: claude-code/claude-opus-5-5
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:43+01:00 }
sources:
  - id: todo
    resource: ../../TODO.md
  - id: templates
    resource: ../../src/notifications/templates.ts
---

# Idea

**Ungeprüft gegen den Betrieb** — bei der Migration am 2026-11-16 offen gelassen („skip").

`TODO.md` (Stand 7. September 2026) meldet drei Vorlagen, die bei Meta fehlten. Zwei davon verschickt der Code weiterhin:

- `schiriplan_termin_geaendert` — wenn ein Admin ein Spiel verschiebt (`src/server/admin/games.ts`). Fehlt sie, erreicht eine Verschiebung niemanden.
- `schiriplan_erinnerung` — jede persönliche Erinnerung (`src/domain/scheduler.ts`). Fehlt sie, fallen alle Erinnerungen aus.

`schiriplan_anmeldung` wird nur gebraucht, wenn `LOGIN_MAGIC_LINK=an` gesetzt wird.

Klären mit dem Testversand aus dem Runbook; fehlen sie noch, anlegen.

# Related

- [WhatsApp-Vorlagen anlegen](/runbooks/whatsapp-vorlagen-anlegen.md)
