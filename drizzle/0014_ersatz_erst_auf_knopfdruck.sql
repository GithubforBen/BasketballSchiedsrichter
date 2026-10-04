-- Raeumt ein Admin einen Schiedsrichter-Platz, wird der Ersatz nicht mehr von
-- selbst gefragt, sondern erst, wenn der Admin "Ersatz anfordern" drueckt.
--
-- Die Spalte haelt fest, bei welchem Stand von `vacancy_version` zuletzt ein
-- Admin geraeumt hat. Stimmen beide ueberein, stammt die juengste Luecke von
-- ihm und die Kaskade wartet. Tritt danach jemand selbst aus, steigt
-- `vacancy_version` — und die Kaskade laeuft wieder von allein.
--
-- NULL fuer alle bestehenden Spiele: an ihnen aendert sich nichts.
ALTER TABLE "games" ADD COLUMN "manual_vacancy_version" integer;
