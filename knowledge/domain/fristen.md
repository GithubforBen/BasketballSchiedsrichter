---
type: Business Rule
title: "Fristen für Austragen und Ersatz anfordern"
description: Selbst austragen geht bis 3 Wochen vor Anpfiff, Ersatz anfordern bis 3 Tage davor; beide Fristen sind einstellbar, der Admin kann je Spiel freigeben.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: rules
    resource: ../../src/domain/rules.ts
---

# Rule

Regeln 7–9:

- Selbst austragen geht bis **21 Tage** vor Anpfiff. Danach ist es gesperrt; der Admin kann es je Spiel freigeben.
- **Ersatz anfordern** geht bis **3 Tage** vor Anpfiff und nur für jemanden, der selbst eingetragen ist. Auch hier gibt es eine Admin-Freigabe je Spiel.
- Beide Fristen sind vereinsweit einstellbar (`withdraw_deadline_days`, `substitute_request_deadline_days`).

# Why

Eintragen ist verbindlich. Kurz vor dem Spiel soll niemand einfach verschwinden, sondern einen Ersatz anstoßen — und in den letzten Tagen ist das ein Fall für den Admin.

# Related

- [Ausfall und Nachrücken](/domain/ausfall-und-nachruecken.md)
