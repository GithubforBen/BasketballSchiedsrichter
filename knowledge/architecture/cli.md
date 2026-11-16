---
type: Component
title: Betriebsskripte (src/cli)
description: "Kommandozeilen-Skripte für den Betrieb: Notzugang, WhatsApp-Vorlagen anlegen, reparieren und testen, Namen zusammenführen."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: notzugang
    resource: ../../src/cli/notzugang.ts
---

# Responsibility

`src/cli/` enthält Skripte, die bewusst nicht im Adminbereich liegen: `notzugang.ts` (Regel 41), `vorlagen-anlegen.ts`, `vorlagen-reparieren.ts` und `vorlagen-test.ts` (Abgleich mit Meta), `namen-zusammenfuehren.ts`. Aufruf mit `npx tsx --tsconfig tsconfig.skripte.json src/cli/<skript>.ts` bzw. über `npm run`.

# Interfaces

Laufen auf dem Server mit der `.env` der Anwendung.

# Related

- [WhatsApp-Vorlagen anlegen](/runbooks/whatsapp-vorlagen-anlegen.md)
- [Notzugang](/domain/notzugang.md)
