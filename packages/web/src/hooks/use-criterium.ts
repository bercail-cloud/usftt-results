import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function useCriteriumTours() {
  return useQuery({
    queryKey: ["criterium-tours"],
    queryFn: () => api.get("/api/criterium/tours"),
  });
}

export function useCriteriumTour(tour: number) {
  return useQuery({
    queryKey: ["criterium", tour],
    queryFn: () => api.get(`/api/criterium/tours/${tour}`),
  });
}

export function useCriteriumDetail(tour: number, licence: string, tourId?: string) {
  return useQuery({
    queryKey: ["criterium", tour, licence, tourId],
    queryFn: () => api.get(`/api/criterium/tours/${tour}/joueurs/${licence}${tourId ? `?tourId=${tourId}` : ""}`),
  });
}
