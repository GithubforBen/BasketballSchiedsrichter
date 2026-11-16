---
type: Decision
title: "Deutsch fest, keine Übersetzungsebene"
description: "Die Oberfläche ist fest deutsch (<html lang=\"de\">), ohne i18n-Ebene; UI-Texte sind deutsch, Code-Bezeichner englisch."
status: draft
decision: accepted
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:37+01:00 }
sources:
  - id: plan-entscheidungen
    resource: ../../PLAN.md
---

# Decision

Die Oberfläche ist fest deutsch, `<html lang="de">`, ohne Übersetzungsebene. UI-Texte und Nachrichten sind deutsch, Bezeichner im Code englisch.

# Why

Alle Nutzer sind im selben deutschen Verein. Eine i18n-Ebene hätte jeden Text hinter einen Schlüssel gesteckt, ohne dass je eine zweite Sprache kommt.

# Rejected alternatives

Keine dokumentiert.

# Related

- [Nachrichten-Wortlaut](/domain/nachrichten-wortlaut.md)
