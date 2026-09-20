-- Die Anfrage an den Ersatz kennt jetzt zwei Anlaesse.
--
-- 'vacancy'  Ein Schiedsrichter-Platz ist frei geworden, die Kaskade fragt der
--            Reihe nach (Regeln 13-16). Eine Absage laesst den Ersatzplatz
--            unberuehrt.
-- 'handover' Jemand hat "Ersatz anfordern" gedrueckt und gibt das Spiel ab.
--            Eine Absage traegt den Ersatz aus und rueckt den naechsten nach.
ALTER TABLE "promotion_offers" ADD COLUMN "kind" text DEFAULT 'vacancy' NOT NULL;

-- Wer den Platz raeumt, sobald die Anfrage angenommen wird. NULL heisst: der
-- Platz ist bereits leer (der Admin hat ihn geraeumt oder jemand ist
-- ausgetreten).
ALTER TABLE "promotion_offers" ADD COLUMN "replaces_referee_id" text;
ALTER TABLE "promotion_offers"
  ADD CONSTRAINT "promotion_offers_replaces_referee_id_referees_id_fk"
  FOREIGN KEY ("replaces_referee_id") REFERENCES "referees"("id") ON DELETE set null;

-- Wer die Anfrage ausgeloest hat — fuer das Pruefprotokoll und die Anzeige.
ALTER TABLE "promotion_offers" ADD COLUMN "requested_by" text;
ALTER TABLE "promotion_offers"
  ADD CONSTRAINT "promotion_offers_requested_by_referees_id_fk"
  FOREIGN KEY ("requested_by") REFERENCES "referees"("id") ON DELETE set null;
