import { z } from "zod";

export const HistoriqueClassementSchema = z.object({
  id: z.number(),
  licence: z.string(),
  saison: z.string(),
  phase: z.number(),
  points: z.number(),
});

export type HistoriqueClassement = z.infer<typeof HistoriqueClassementSchema>;

export const PartieIndividuelleSchema = z.object({
  id: z.number(),
  licence: z.string(),
  adversaireLicence: z.string(),
  adversaireNom: z.string(),
  adversaireClassement: z.number(),
  victoire: z.boolean(),
  pointsResultat: z.number(),
  coefficient: z.number(),
  datePartie: z.string(),
  epreuve: z.string(),
  journee: z.number(),
});

export type PartieIndividuelle = z.infer<typeof PartieIndividuelleSchema>;
