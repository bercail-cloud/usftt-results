DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'criterium_classement_division_id_nom_tour_unique'
  ) THEN
    ALTER TABLE "criterium_classement" ADD CONSTRAINT "criterium_classement_division_id_nom_tour_unique" UNIQUE("division_id","nom","tour");
  END IF;
END $$;
