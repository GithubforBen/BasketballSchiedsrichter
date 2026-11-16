---
type: Business Rule
title: "Nachrichten kosten Geld: Sparsamkeit ist ein Produktziel"
description: "Jede Nachricht kostet den Verein Geld; neue Auslöser brauchen eine Begründung. Quittung und Ausschreibung sind im Adminbereich schaltbar."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: notifications
    resource: ../../src/domain/notifications.ts
---

# Rule

Regeln 31–33 und 47:

- Jede Nachricht kostet den Verein Geld. Sparsamkeit ist ein Produktziel; jeder neue Nachrichtenauslöser muss begründet sein und im Kostenzähler auftauchen.
- Wer sich einträgt, bekommt eine **Quittung** („Das Spiel gehört dir") mit Datum, Zeit, Ort und Liga. Sie ist im Adminbereich ganz abschaltbar.
- Das **Anlegen** eines Spiels benachrichtigt niemanden.
- Der Admin kann per Knopf alle Qualifizierten an ein offenes Spiel erinnern („Notruf"); vorher steht eine Rückfrage mit der Zahl der Empfänger.
- Die **Ausschreibung** eines offenen Platzes geht an *alle Qualifizierten*, *nur die Admins* oder *niemanden* — der Verein entscheidet, nicht der Code.

# Why

Das WhatsApp-Budget liegt bei 2000 Nachrichten im Monat. Die Ausschreibung ist die einzige Nachricht an viele auf einmal und bestimmt die Kosten fast allein.

# Related

- [Ausschreibung](/domain/ausschreibung.md)
- [Anmeldung mit Passwort](/decisions/anmeldung-mit-passwort.md)
