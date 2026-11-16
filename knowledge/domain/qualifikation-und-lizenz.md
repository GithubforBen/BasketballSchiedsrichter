---
type: Term
title: Qualifikation und Lizenz
description: "Qualifikation: für welche Liga jemand eingeteilt werden darf. Lizenz: welche Spielstufe jemand pfeifen darf. Beides muss passen."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:40+01:00 }
sources:
  - id: rules
    resource: ../../src/domain/rules.ts
  - id: license
    resource: ../../src/domain/license.ts
---

# Meaning

- **Qualifikation** (`qualifications`): je Liga, ob jemand für diese Altersklasse eingeteilt werden darf. Pflegt der Admin in der Qualifikationsmatrix.
- **Lizenz** (`referees.license`): E, D oder C, welche Spielstufe jemand pfeifen darf.

Zum Eintragen müssen beide passen.

# Not to be confused with

Die beiden werden oft verwechselt; die Lizenz ersetzt die Qualifikation nicht.

# Related

- [Lizenzen](/domain/lizenzen.md)
- [Ligen](/decisions/ligen-vorbelegt.md)
