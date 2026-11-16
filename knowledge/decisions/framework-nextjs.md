---
type: Decision
title: Next.js mit App Router, React und strengem TypeScript
description: "Die App ist eine Next.js-Anwendung (App Router) mit React und TypeScript im strict-Modus — ein Projekt für Oberfläche und Server."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:35+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: package
    resource: ../../package.json
---

# Decision

Schiriplan ist eine einzige Next.js-Anwendung mit App Router, React und TypeScript im strict-Modus. Seiten, Serveraktionen und API-Routen leben im selben Projekt unter `src/`. Bei der Planung war es Next.js 15 mit React 19; das ist auch der Stand in `package.json`.

# Why

Ein Verein mit einer Handvoll Admins braucht keine getrennte API und kein getrenntes Frontend. Ein Projekt, ein Deployment, ein Container — das hält den Betrieb auf dem eigenen Server einfach. Strenges TypeScript fängt Fehler in der Regel-Engine früh ab.

# Rejected alternatives

Keine dokumentiert; `PLAN.md` §1 nennt die Wahl ohne Gegenkandidaten.

# Related

- [Styling ohne Framework](/decisions/styling-plain-css-modernist.md)
- [Datenbank](/decisions/datenbank-postgres-drizzle.md)
