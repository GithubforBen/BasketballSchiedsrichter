---
type: Component
title: "Oberfläche (src/app, src/components)"
description: "Next.js-Seiten für öffentliche Ansicht, Schiedsrichter- und Adminbereich, eine responsive App für Desktop und Handy."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:41+01:00 }
sources:
  - id: routes
    resource: ../../src/routes.ts
---

# Responsibility

`src/app/` hält die Seiten (App Router): öffentlicher Spielplan, `anmelden`, `kalender`, `profil`, `spiele`, `schiris`, `einstellungen`, `meldungen`, `nachrichten`, `antwort`, `regeln`, `impressum` u. a.; `src/components/` die gemeinsamen Bausteine. Ab 1024 px Sidebar-Layout, darunter Bottom-Tab-Bar. `src/routes.ts` sammelt die Pfade.

# Interfaces

Ruft `src/server/` über Serveraktionen und Server-Komponenten auf.

# Related

- [Styling](/decisions/styling-plain-css-modernist.md)
