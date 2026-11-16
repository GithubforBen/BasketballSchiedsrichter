---
type: Business Rule
title: "Offene Plätze als Tagesbilanz an die Admins"
description: Bei Ausschreibung nur an Admins kommt abends eine Bilanz statt Einzelnachrichten; jeder Admin stellt Zeitraum (Standard 4 Wochen) und Empfang selbst ein.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: tagesuebersicht
    resource: ../../src/server/tagesuebersicht.ts
---

# Rule

Regeln 49–50:

- Steht die Ausschreibung auf *nur die Admins*, geht einmal am Abend **eine** Nachricht raus: wie viele Spiele eine Lücke haben, bei wie vielen gar kein Schiedsrichter steht, wie eilig der nächste Fall ist.
- Gezählt wird über alle künftigen Spiele der Saison und nur über die beiden Schiedsrichterplätze; ein fehlender Ersatz ist kein Loch.
- Jeder Admin stellt in seinem Profil ein, wie viele Wochen die Tagesübersicht vorausschaut (Standard 4, 1–52) und ob sie überhaupt kommt. Der vereinsweite Schalter bleibt daneben bestehen.

# Why

Zehn Lücken ergaben vorher zehn gleichlautende Aufrufe an dieselben drei Leute. Ohne Zeitraum stünde am Saisonanfang der halbe Spielplan in einer Nachricht.

# Related

- [Nachrichten sparsam](/domain/nachrichten-sparsamkeit.md)
- [Rotation und Admin-Meldungen](/domain/rotation-und-admin-meldungen.md)
