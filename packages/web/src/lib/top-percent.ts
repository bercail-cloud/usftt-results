interface RankablePlayer {
  licence: string;
  points_mensuels: number | null;
  nb_matchs: number | null;
}

export function computeTopPercent(joueurs: ReadonlyArray<RankablePlayer>): Map<string, number> {
  const ranked = joueurs.filter(
    (j): j is RankablePlayer & { points_mensuels: number } =>
      (j.nb_matchs ?? 0) > 0 && j.points_mensuels != null
  );
  const total = ranked.length;

  return new Map(
    ranked.map((j) => {
      const rank = 1 + ranked.filter((o) => o.points_mensuels > j.points_mensuels).length;
      return [j.licence, Math.ceil((rank / total) * 100)];
    })
  );
}
