import { z } from "zod";

export const JoueurSchema = z.object({
  licence: z.string(),
  nom: z.string(),
  prenom: z.string(),
  clubNumero: z.string(),
  pointsOfficiels: z.number().nullable(),
  pointsMensuels: z.number().nullable(),
  categorie: z.string().nullable(),
  rangDepartemental: z.number().nullable(),
  rangRegional: z.number().nullable(),
  sexe: z.string(),
});

export type Joueur = z.infer<typeof JoueurSchema>;
