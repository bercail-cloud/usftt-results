import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useEquipes(type?: string) {
  return useQuery({
    queryKey: ["equipes", type],
    queryFn: () => api.get(`/api/equipes${type ? `?type=${type}` : ""}`),
  });
}

export function useEquipeDetail(id: string) {
  return useQuery({
    queryKey: ["equipes", id],
    queryFn: () => api.get(`/api/equipes/${id}`),
  });
}

export function useRencontreDetail(equipeId: string, rencId: string) {
  return useQuery({
    queryKey: ["rencontre", equipeId, rencId],
    queryFn: () => api.get(`/api/equipes/${equipeId}/rencontres/${rencId}`),
  });
}
