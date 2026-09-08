-- Zwei Aenderungen am Spiel, beide aus derselben Spielplandatei gelernt.

-- 1. Das Kuerzel des Verbands bleibt erhalten.
--
-- Die Liga am Spiel ist die gedeutete Altersklasse ("U14"), gewonnen aus
-- Kuerzeln wie "XU14Bz". Was dabei verloren geht — Geschlecht, Staffel,
-- Gruppe — steht ab jetzt daneben und wird angezeigt: nicht jeder pfeift
-- jede Klasse gleich gern, und das entscheidet man vor dem Eintragen.
ALTER TABLE "games" ADD COLUMN "league_label" text DEFAULT '' NOT NULL;
--> statement-breakpoint
-- Bestehende Spiele tragen ihre Liga als Kuerzel, damit die Anzeige nicht
-- leer bleibt. Von Hand angelegte Spiele haben ohnehin nichts anderes.
UPDATE "games" SET "league_label" = "league_id" WHERE "league_label" = '';
--> statement-breakpoint
-- 2. Dieselbe Paarung darf es zweimal geben.
--
-- Der Verband setzt zur selben Zeit in derselben Halle zwei Begegnungen an;
-- beide brauchen eigene Schiedsrichter. Der eindeutige Index liess davon nur
-- eine zu, und der Import verwarf die zweite stillschweigend — aus vierzig
-- Zeilen wurden vierunddreissig Spiele. Der Index bleibt als Nachschlagehilfe
-- fuer die Duplikaterkennung, aber ohne Eindeutigkeit; wiederholbar bleibt der
-- Import dadurch, dass er die Vorkommen zaehlt statt sie nur zu sehen.
DROP INDEX IF EXISTS "games_natural_key";
--> statement-breakpoint
CREATE INDEX "games_natural_key" ON "games" ("kickoff", "home", "away");
