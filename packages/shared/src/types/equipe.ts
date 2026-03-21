import { z } from "zod";

export const EquipeSchema = z.object({
  id: z.number(),
  libEquipe: z.string(),
  libDivision: z.string(),
  idPoule: z.string(),
  idDivision: z.string(),
  idEpreuve: z.string(),
  libEpreuve: z.string(),
  typeEpreuve: z.string(),
});

export type Equipe = z.infer<typeof EquipeSchema>;

export const ClassementPouleSchema = z.object({
  id: z.number(),
  equipeId: z.number(),
  clubNumero: z.string(),
  nomEquipe: z.string(),
  position: z.number(),
  points: z.number(),
  joue: z.number(),
  victoires: z.number(),
  defaites: z.number(),
  nuls: z.number(),
  partiesGagnees: z.number(),
  partiesPerdues: z.number(),
});

export type ClassementPoule = z.infer<typeof ClassementPouleSchema>;

export const RencontreSchema = z.object({
  id: z.number(),
  equipeId: z.number(),
  libelle: z.string(),
  equipeA: z.string(),
  equipeB: z.string(),
  scoreA: z.number().nullable(),
  scoreB: z.number().nullable(),
  datePrevue: z.string(),
  dateReelle: z.string(),
  lienDetail: z.string().nullable(),
  isDomicile: z.boolean(),
});

export type Rencontre = z.infer<typeof RencontreSchema>;

export const PartieRencontreSchema = z.object({
  id: z.number(),
  rencontreId: z.number(),
  joueurA: z.string(),
  classementA: z.string(),
  joueurB: z.string(),
  classementB: z.string(),
  scoreA: z.number(),
  scoreB: z.number(),
  detailSets: z.string(),
});

export type PartieRencontre = z.infer<typeof PartieRencontreSchema>;
