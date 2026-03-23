import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useJoueurs() {
  return useQuery({
    queryKey: ["joueurs"],
    queryFn: () => api.get("/api/joueurs"),
  });
}

export function useJoueurProgression(licence: string) {
  return useQuery({
    queryKey: ["progression", licence],
    queryFn: () => api.get(`/api/joueurs/${licence}/progression`),
    enabled: !!licence,
  });
}

export function useJoueurEquipes(licence: string) {
  return useQuery({
    queryKey: ["joueur-equipes", licence],
    queryFn: () => api.get(`/api/joueurs/${licence}/equipes`),
    enabled: !!licence,
  });
}

export function useJoueurParties(licence: string) {
  return useQuery({
    queryKey: ["parties", licence],
    queryFn: () => api.get(`/api/joueurs/${licence}/parties`),
    enabled: !!licence,
  });
}
