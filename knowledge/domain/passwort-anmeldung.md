---
type: Business Rule
title: "Anmeldung mit Passwort: Start-Passwort, Wechselzwang, nur Hashes"
description: Login mit Telefonnummer und Passwort; ein Start-Passwort aus dem Namen gilt 14 Tage und muss gewechselt werden; gespeichert wird nur ein scrypt-Hash.
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-11-16T12:16:39+01:00 }
sources:
  - id: plan-regeln
    resource: ../../PLAN.md
  - id: password
    resource: ../../src/domain/password.ts
---

# Rule

Regeln 34–40:

- Angemeldet wird mit **Telefonnummer und Passwort**; die Telefonnummer ist die Kennung.
- Ein neues Konto bekommt ein **Start-Passwort aus dem Namen**: Vor- und Nachname zusammen, klein, Umlaute ausgeschrieben, alles andere entfällt („Anna-Lena Weiß" → `annalenaweiss`). Es steht nirgends im Klartext in der Datenbank.
- Das Start-Passwort gilt **14 Tage**; danach muss ein Admin es neu setzen.
- Nach der Anmeldung damit **muss** ein eigenes Passwort gesetzt werden; bis dahin ist nur die Passwortseite und das Abmelden erreichbar.
- Für das eigene Passwort gibt es bewusst keine Längen- oder Zeichenregeln. Es darf nur nicht leer sein und muss sich vom bisherigen unterscheiden.
- Passwörter werden nur gehasht gespeichert (scrypt, Salz je Konto). Klartext ist überall verboten — Datenbank, Protokoll, Prüfprotokoll, Datenauszug.
- Ein Admin kann das Passwort zurücksetzen; das Konto fällt dann auf das Start-Passwort mit neuer 14-Tage-Frist zurück.

# Why

Das Nachrichtenbudget lässt keine Anmeldung per WhatsApp zu. Das Start-Passwort aus dem Namen braucht keinen Versand, die kurze Frist und der Wechselzwang begrenzen das Risiko, dass es jeder erraten kann.

# Related

- [Anmeldung mit Passwort (Entscheidung)](/decisions/anmeldung-mit-passwort.md)
- [Notzugang](/domain/notzugang.md)
- [Telefonnummern](/domain/telefonnummern.md)
