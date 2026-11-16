---
type: Business Rule
title: "Ausfall und Nachrück-Kaskade"
description: Sagt ein Schiri ab, werden Ersatz 1, dann Ersatz 2 mit Frist gefragt; dann wird ausgeschrieben. Frist 12 h, kurz vor Anpfiff ein Drittel der Restzeit.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:38+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: escalation
    resource: ../../src/domain/escalation.ts
---

# Rule

Regeln 13–16 und die Annahme zur Nachrück-Frist:

- Sagt ein Schiedsrichter ab, wird **Ersatz 1** gefragt („Rückst du nach?"), mit Antwortfrist.
- Lehnt Ersatz 1 ab oder läuft die Frist ab, wird **Ersatz 2** mit derselben Frist gefragt.
- Lehnt auch Ersatz 2 ab oder verstreicht die Frist, wird der Platz für alle Qualifizierten **ausgeschrieben**.
- Wer nachrückt, belegt den Schiedsrichterplatz und bekommt eine Pflichtbestätigung. Der frei gewordene Ersatzplatz wird ausgeschrieben.
- Entfernt der **Admin** einen Schiedsrichter, wird der Ersatz nicht von selbst gefragt, sondern erst, wenn der Admin „Ersatz anfordern" drückt. Steht kein Ersatz bereit, wird der Platz ausgeschrieben.
- Antwortfrist: einstellbar, Standard 12 Stunden. Bleibt weniger als das Dreifache der Frist bis Anpfiff, gilt ein Drittel der Restzeit (bei 12 h also ab 36 h Restzeit).

# Why

Der Ersatz hat sich bewusst bereit erklärt und soll zuerst die Chance bekommen, bevor eine teure Ausschreibung an alle geht. Die gekürzte Frist sorgt dafür, dass die Kaskade auch kurz vor dem Spiel noch bis zur Ausschreibung durchläuft.

# Related

- [Nachrücken (Begriff)](/domain/nachruecken.md)
- [Ausschreibung](/domain/ausschreibung.md)
- [Fristen](/domain/fristen.md)
