-- "Erwachsene" und "Senioren" bezeichnen dieselbe Gruppe. Es bleibt "Senioren".
--
-- Reine Datenmigration, kein Schemawechsel: die Liga ist eine Zeile in
-- "leagues", und ihre Kennung ist ihr Name. Zusammenlegen heisst deshalb,
-- alles Angehaengte umzuhaengen und die Zeile danach zu loeschen.

-- Sollte "Senioren" fehlen, entsteht sie hier — sonst liefe das Umhaengen ins
-- Leere und der Fremdschluessel schluege fehl.
--
-- Nur, wenn es "Erwachsene" ueberhaupt gibt: auf einer frischen Datenbank
-- laufen die Migrationen vor dem Seed, die Tabelle ist dann leer, und eine
-- einzelne angelegte Liga waere schlimmer als keine. `seed:admin` legt die
-- Anfangsligen naemlich nur an, solange gar keine dasteht — mit einer
-- einzelnen "Senioren" ueberspraenge er sie und scheiterte danach daran,
-- Qualifikationen fuer U14, U16 und U18 einzutragen, die es nicht gibt.
-- Die Platzziffer steht als Unterabfrage und nicht als Aggregat ueber dem
-- SELECT: ein Aggregat ohne GROUP BY liefert *immer* eine Zeile, auch wenn
-- das WHERE nichts findet — die Liga entstuende dann trotzdem.
INSERT INTO "leagues" ("id", "name", "active", "sort_order")
SELECT 'Senioren', 'Senioren', true, COALESCE((SELECT MAX("sort_order") + 1 FROM "leagues"), 0)
WHERE EXISTS (SELECT 1 FROM "leagues" WHERE "id" = 'Erwachsene')
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
-- Qualifikationen umhaengen. Wer beide hatte, behaelt eine: der
-- Primaerschluessel ist (referee_id, league_id), das Doppelte faellt weg.
INSERT INTO "qualifications" ("referee_id", "league_id")
SELECT "referee_id", 'Senioren' FROM "qualifications" WHERE "league_id" = 'Erwachsene'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
DELETE FROM "qualifications" WHERE "league_id" = 'Erwachsene';
--> statement-breakpoint
-- Spiele umhaengen. Muss vor dem Loeschen stehen: "games"."league_id"
-- verweist ohne Kaskade auf "leagues", ein Rest wuerde das Loeschen abweisen.
UPDATE "games" SET "league_id" = 'Senioren' WHERE "league_id" = 'Erwachsene';
--> statement-breakpoint
DELETE FROM "leagues" WHERE "id" = 'Erwachsene';
