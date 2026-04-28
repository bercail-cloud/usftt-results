import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useEquipes(type?: string) {
  return useQuery({
    queryKey: ["equipes", type],
    queryFn: () => {
      const qs = type ? `?type=${encodeURIComponent(type)}` : "";
      return api.get(`/api/equipes${qs}`);
    },
  });
}

export function useEquipeDetail(id: string) {
  return useQuery({
    queryKey: ["equipes", id],
    queryFn: () => api.get(`/api/equipes/${encodeURIComponent(id)}`),
  });
}

export function useRencontreDetail(equipeId: string, rencId: string) {
  return useQuery({
    queryKey: ["rencontre", equipeId, rencId],
    queryFn: () =>
      api.get(
        `/api/equipes/${encodeURIComponent(equipeId)}/rencontres/${encodeURIComponent(rencId)}`
      ),
  });
}
