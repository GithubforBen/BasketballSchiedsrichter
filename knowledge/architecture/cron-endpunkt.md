---
type: Interface
title: Cron-Endpunkt /api/cron
description: "POST arbeitet fällige Fristen und Nachrichten ab, GET zeigt nur, was fällig wäre; geschützt mit CRON_SECRET."
status: draft
stale_after: 2027-02-14T12:16:42+01:00
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: route
    resource: ../../src/app/api/cron/route.ts
---

# Contract summary

`POST /api/cron` mit `authorization: Bearer $CRON_SECRET` arbeitet ab: Nachrichtenplan fällig stellen, Outbox leeren. `GET` ist ein Trockenlauf, damit ein Linkprüfer oder vorausladender Browser keine Nachrichten auslöst. Doppelte Läufe sind folgenlos (Idempotenzschlüssel).

# Consumers

Der `cron`-Dienst in `docker-compose.yml`, alle 5 Minuten.

# Related

- [Betriebsverbund](/architecture/betriebsverbund.md)
- [Outbox](/domain/outbox.md)
