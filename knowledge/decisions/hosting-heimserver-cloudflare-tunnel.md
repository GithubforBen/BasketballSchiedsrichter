---
type: Decision
title: "Betrieb auf dem eigenen Server, nach außen nur über Cloudflare Tunnel"
description: "Schiriplan läuft per Docker Compose auf einem eigenen Server im Heimnetz; öffentlich erreichbar nur über einen Cloudflare Tunnel, ohne offenen Port."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:36+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
  - id: compose
    resource: ../../docker-compose.yml
---

# Decision

Die Anwendung läuft mit Docker Compose auf einem eigenen Server im Heimnetz. Von außen ist sie nur über einen Cloudflare Tunnel erreichbar (`tunnel`-Dienst in `docker-compose.yml`); kein Port ist ins Internet geöffnet. Alle Dienste stehen auf `restart: always` und kommen nach einem Neustart von selbst wieder hoch. Werkzeuge nur für die Verwaltung (z. B. CloudBeaver) sind an die LAN-Adresse gebunden und nie über den Tunnel erreichbar.

`PLAN.md` §1 nennt noch einen „eigenen VPS". Die Entscheidung für Docker Compose und den Tunnel ist dieselbe geblieben, der Ort hat gewechselt; Kommentare in `docker-compose.yml` und `README.md`, die von einem VPS sprechen, stammen aus dieser Zeit.

# Why

Kein offener Port heißt keine Angriffsfläche am Router. Der Tunnel bringt TLS und eine feste Adresse mit, die sich nicht mit dem Netz ändert. Docker Compose zieht Datenbank, Zeitgeber, Sicherung und Tunnel mit einem Befehl hoch.

# Rejected alternatives

- Gemieteter VPS — ursprünglich geplant; ersetzt durch den eigenen Server.

# Related

- [Betriebsverbund](/architecture/betriebsverbund.md)
