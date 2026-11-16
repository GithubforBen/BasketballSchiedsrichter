---
type: Decision
title: "Tests: Vitest für Regeln, echtes Postgres für Integration, Playwright auf Desktop und Handy"
description: "Die Regel-Engine wird mit Vitest getestet, Serverpfade gegen ein echtes Postgres, die Oberfläche mit Playwright auf Desktop und Mobil."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: vitest
    resource: ../../vitest.config.ts
  - id: playwright
    resource: ../../playwright.config.ts
---

# Decision

- Reine Fachlogik (`src/domain/`) mit Vitest, ohne Datenbank.
- Integrationstests (`*.integration.test.ts`) gegen ein echtes PostgreSQL.
- Ende-zu-Ende mit Playwright (`e2e/`), jeweils Desktop und Mobil.

Regeln aus `PLAN.md` tragen ihre Nummer im Namen eines Tests.

# Why

Die Kernregeln (gleichzeitiges Eintragen, Idempotenz der Outbox) hängen an Datenbank-Constraints und Sperren; eine Attrappe würde genau das nicht prüfen. Die App wird überwiegend auf dem Handy benutzt, deshalb laufen E2E-Tests in beiden Formaten.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Datenbank](/decisions/datenbank-postgres-drizzle.md)
