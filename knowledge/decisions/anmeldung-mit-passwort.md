---
type: Decision
title: Anmeldung mit Telefonnummer und Passwort statt Link per WhatsApp
description: Angemeldet wird mit Telefonnummer und Passwort. Der Login per Link ist gebaut, aber abgeschaltet, weil jeder Link eine WhatsApp-Nachricht kostet.
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:36+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: plan-m7
    resource: ../../PLAN.md
  - id: login
    resource: ../../src/server/auth/login.ts
---

# Decision

Angemeldet wird mit Telefonnummer und Passwort. Der ursprünglich geplante Weg ohne Passwort — Magic-Link und 6-stelliger Code in einer WhatsApp-Nachricht — ist vollständig gebaut und getestet, steht aber voreingestellt auf aus. `LOGIN_MAGIC_LINK=an` schaltet ihn wieder frei.

# Why

Der Verein hat für WhatsApp ein Budget von 2000 Nachrichten im Monat, und jede Anmeldung per Link verbraucht eine davon. Das passt nicht hinein. `PLAN.md` §1 nennt noch „Passwordless"; die Änderung kam mit Meilenstein M7 (Regeln 34–43).

# Rejected alternatives

- Nur Magic-Link/Code per WhatsApp — zu teuer im Betrieb; bleibt als zuschaltbarer Weg erhalten.

# Related

- [Anmeldung mit Passwort](/domain/passwort-anmeldung.md)
- [Notzugang](/domain/notzugang.md)
