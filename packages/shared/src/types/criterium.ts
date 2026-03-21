import { z } from "zod";

export const CriteriumClassementSchema = z.object({
  id: z.number(),
  divisionId: z.string(),
  divisionLibelle: z.string(),
  rang: z.number(),
  licence: z.string().nullable(),
  nom: z.string(),
  club: z.string(),
  classement: z.number(),
  points: z.number(),
  tour: z.number(),
});

export type CriteriumClassement = z.infer<typeof CriteriumClassementSchema>;

export const CriteriumTourSummarySchema = z.object({
  tour: z.number(),
  joueursEngages: z.number(),
  totalVictoires: z.number(),
  totalDefaites: z.number(),
  meilleurJoueur: z.string().nullable(),
  meilleurBilan: z.string().nullable(),
});

export type CriteriumTourSummary = z.infer<typeof CriteriumTourSummarySchema>;
