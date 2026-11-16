---
type: Business Rule
title: "Wortlaut jeder Nachricht: Datum und Vorlauf, kein Nachfolger, eigener Link, Vorname"
description: "Jede Nachricht nennt Datum, Uhrzeit und Vorlauf, stellt keinen Nachfolger in Aussicht, antwortet über einen eigenen Link und spricht mit Vornamen an."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: templates
    resource: ../../src/notifications/templates.ts
  - id: action-links
    resource: ../../src/notifications/action-links.ts
---

# Rule

Regeln 44–46 und 48, gültig für alle Nachrichten:

- **Datum, Uhrzeit und Vorlauf**: „Sa 29.08.2026, 10:30 Uhr" und „Anpfiff in 3 Tagen" — auch in jeder Zeile der Tagesübersicht.
- **Kein Nachfolger in Aussicht**: kein „sonst fragen wir den nächsten Ersatz". Was ohne Antwort geschieht, ist Sache der Anwendung.
- **Jede Antwort über einen eindeutigen Link** `…/antwort/<Token>`. Der signierte Token nennt Vorgang, Spiel, Person und Nachricht und gilt bis zum Anpfiff. Er steht am Ende des Pfades, weil Meta bei dynamischen URL-Knöpfen genau eine Variable am Ende erlaubt.
- **Anrede mit Vornamen**. Der Vorname ist ein eigenes Feld, beim Anlegen mit dem ersten Wort vorgeschlagen und vom Admin korrigierbar.

# Why

Das Datum sagt, welches Spiel gemeint ist, der Vorlauf, wie eilig es ist. Wer liest, dass sich ohnehin jemand findet, sagt eher ab. Ein Link auf eine Liste führt dazu, dass das falsche Spiel bestätigt wird. Bei „von der Heide Tim" wäre das erste Wort als Anrede falsch.

# Related

- [Antwortlinks](/architecture/antwortlinks.md)
- [WhatsApp-Vorlagen](/references/whatsapp-vorlagen.md)
