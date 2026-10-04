-- "Spiele nachpflegen" faellt weg.
--
-- Gezaehlt wird ab jetzt, wer zum Anpfiff auf Schiri 1 oder Schiri 2 steht —
-- das ist die Besetzung, die gilt, und sie braucht keine Bestaetigung mehr.
-- Eine Korrektur laeuft ueber das Bearbeiten des Spiels selbst, das jetzt auch
-- fuer vergangene Spiele offensteht. Die Spalte war in dieser Datenbank
-- durchgehend NULL, es geht also nichts verloren.
ALTER TABLE "assignments" DROP COLUMN IF EXISTS "played_as_referee";
