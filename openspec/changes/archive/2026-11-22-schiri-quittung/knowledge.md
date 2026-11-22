## Delta

```yaml
ops:
  - op: create
    path: capabilities/schiri-quittung.md
    type: Capability
    summary: Jeder Schiri exportiert die Vereinsquittung über Schiedsrichtergebühren als PDF, vorausgefüllt mit Spiel, beiden Schiris und Beträgen.
  - op: create
    path: domain/fahrtkosten-und-gebuehren.md
    type: Business Rule
    summary: "Fahrtkosten 0,30 €/km allein, 0,32 €/km mit Mitfahrer, mitgefahren 0 €; Gebühr je Liga; es gelten Satz und Gebühr zum Anpfiff."
  - op: create
    path: decisions/quittung-pdf-mit-pdf-lib.md
    type: Decision
    summary: Quittung als serverseitiges PDF mit pdf-lib statt Druckansicht im Browser oder Ausfüllen der alten Excel-PDF.
  - op: update
    path: architecture/datenbank.md
    type: Component
    summary: Neue Tabellen assignment_expenses, km_rates und league_fees mit Verlauf über valid_from.
  - op: update
    path: architecture/verarbeitete-daten.md
    type: Data Flow
    summary: Fahrtart, Kilometer, Tagegeld und Sonstiges je Einsatz kommen als neue personenbezogene Daten dazu.
empty_reason: ""
```

## Notes

The rejected alternatives from design.md D4 (print view, filling the old PDF) are recorded in the decision concept. The Art. 15 export and the privacy page are covered by the open commitment `commitments/quittungsdaten-auskunft-datenschutz.md`, not by this change.
