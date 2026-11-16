---
type: Business Rule
title: "Statistik: gezählt wird, wer zum Anpfiff auf dem Schiedsrichterplatz steht"
description: "Abrechnungsrelevant zählt nur ein Einsatz auf Schiri 1 oder 2 zum Anpfiff; das Ranking zeigt nur die eigene Person mit Namen und Zahl."
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:38+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: stats
    resource: ../../src/domain/stats.ts
---

# Rule

Regeln 25–28, im heutigen Stand:

- Gezählt werden nur Einsätze **als Schiedsrichter auf dem Feld**. Die Zahl ist abrechnungsrelevant — der Verein bezahlt pro gepfiffenem Spiel.
- Es zählt allein der Platz zum Anpfiff: wer dann auf Schiri 1 oder Schiri 2 steht, hat gepfiffen, auch wer dorthin nachgerückt ist. Ein Ersatz, der auf der Bank blieb, zählt nicht. Nur angepfiffene Spiele zählen.
- Stimmt das ausnahmsweise nicht, ändert der Admin die **Besetzung des vergangenen Spiels**.
- Ranking: nur die eigene Person namentlich mit Zahl, alle anderen anonym ohne Zahl.

`PLAN.md` (Regel 27, Screen „Spiele nachpflegen") sah noch eine Korrektur je Spiel vor. Der Bildschirm wurde abgeschafft; gilt der Stand im Code (bestätigt bei der Migration am 2026-11-16).

# Why

Die Korrektur je Spiel verlangte nach jedem vergangenen Spiel mit Ersatz eine Entscheidung, die fast immer „nein" lautete; bis dahin stand die Abrechnungszahl auf „ungeklärt". Die Besetzung zum Anpfiff stimmt ohne Zutun.

# Related

- [Nachrücken](/domain/nachruecken.md)
