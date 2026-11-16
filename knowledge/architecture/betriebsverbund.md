---
type: Component
title: Betriebsverbund (docker-compose.yml)
description: "Die Dienste im Betrieb: App, Postgres, Zeitgeber, tägliche Sicherung, Cloudflare Tunnel und CloudBeaver nur im LAN."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:42+01:00 }
sources:
  - id: compose
    resource: ../../docker-compose.yml
---

# Responsibility

`docker-compose.yml` bringt alle Dienste mit `restart: always` hoch: `app`, `db` (Postgres), `cron` (ruft alle 5 Minuten `POST /api/cron` im internen Netz), `backup` (tägliche Sicherung, 14 Stände), `tunnel` (cloudflared) und CloudBeaver, das nur an die LAN-Adresse gebunden ist. `einrichten.sh` richtet einen leeren Server ein, `aktualisieren.sh` spielt `main` ein.

# Interfaces

Nach außen nur der Tunnel.

# Related

- [Hosting](/decisions/hosting-heimserver-cloudflare-tunnel.md)
- [Cron-Endpunkt](/architecture/cron-endpunkt.md)
