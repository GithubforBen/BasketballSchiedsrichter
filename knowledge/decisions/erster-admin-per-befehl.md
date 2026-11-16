---
type: Decision
title: Der erste Admin entsteht per Befehl auf dem Server
description: "Weil Konten ausschließlich Admins anlegen, entsteht der erste Admin über npm run seed:admin, nicht über die Oberfläche."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: readme
    resource: ../../README.md
  - id: seed-admin
    resource: ../../src/db/seed-admin.ts
---

# Decision

Konten legen ausschließlich Admins an. Der allererste Admin entsteht deshalb auf dem Server: `npm run seed:admin -- --name "…" --initials … --phone "…"`. Der Befehl nennt zum Schluss das Start-Passwort.

# Why

Eine offene Registrierung gibt es nicht, und eine Registrierung nur für „den ersten" wäre eine Lücke, solange niemand sie benutzt hat. Wer Zugang zum Server hat, darf auch den ersten Admin anlegen.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Anmeldung mit Passwort](/domain/passwort-anmeldung.md)
- [Notzugang](/domain/notzugang.md)
