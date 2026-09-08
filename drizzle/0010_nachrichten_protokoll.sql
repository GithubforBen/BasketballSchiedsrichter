-- Die verschickte Nachricht wird festgehalten.
--
-- Der Text entstand bisher erst beim Versand — aus dem frisch gelesenen Spiel —
-- und war danach nirgends gespeichert. Wer wissen wollte, was jemand bekommen
-- hat, konnte ihn nur nachbauen und bekam dabei den *heutigen* Stand: ein Spiel,
-- das nach der Nachricht verlegt wurde, zeigte in der Vorschau den neuen Termin,
-- obwohl in der Nachricht der alte stand. Auf "was habt ihr mir geschickt?" gab
-- es damit keine belastbare Antwort.
--
-- Die Spalten sind bewusst NULL-bar: alle wartenden Zeilen haben noch keinen
-- Versuch hinter sich, und die alten Zeilen bekommen ihren Text nicht mehr
-- nachtraeglich. Was vor dieser Migration verschickt wurde, bleibt unbelegt.
ALTER TABLE "notification_outbox" ADD COLUMN "sent_subject" text;--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "sent_body" text;--> statement-breakpoint
-- Der Vorlagen-Aufruf, den die WhatsApp Cloud API bekommen hat: Name, Sprache,
-- Werte, Knopfwert. Der Fliesstext daneben ist die lesbare Fassung; verschickt
-- wird bei WhatsApp die Vorlage. Ob eine Ablehnung am Namen lag (Code 132001)
-- oder an der Zahl der Werte (132000), steht nur hier.
ALTER TABLE "notification_outbox" ADD COLUMN "sent_template" jsonb;
