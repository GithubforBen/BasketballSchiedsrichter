---
type: Interface
title: "Antwortlinks /antwort/<Token>"
description: "Signierte Einmal-Adressen für Bestätigung, Nachrück-Anfrage und Verschiebung; gelten bis Anpfiff und handeln erst auf Knopfdruck."
status: draft
stale_after: 2027-02-14T12:16:42+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: action-links
    resource: ../../src/notifications/action-links.ts
  - id: answers
    resource: ../../src/server/answers.ts
---

# Contract summary

`/antwort/<Token>`: der Token ist mit HMAC-SHA256 signiert und nennt Vorgang (`confirm`, `promotion`, `relocation`), Spiel, Person und Nachrichtenschlüssel; er läuft mit dem Anpfiff ab. Die Seite zeigt genau eine Frage und ändert erst auf Knopfdruck etwas, damit eine Linkvorschau nichts auslöst. Kein Login nötig; der Token öffnet nur diese eine Frage.

# Consumers

Die WhatsApp-Vorlagen mit dynamischem URL-Knopf.

# Related

- [Nachrichten-Wortlaut](/domain/nachrichten-wortlaut.md)
