interface RankCircleProps {
  rank: number;
  total?: number;
}

function getRankColorClass(rank: number): string {
  if (rank === 1) return "bg-success-light text-success";
  if (rank <= 3) return "bg-amber-100 text-amber-700";
  return "bg-border-light text-text-secondary";
}

export function RankCircle({ rank, total }: RankCircleProps) {
  const colorClass = getRankColorClass(rank);

  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${colorClass}`}
      title={total !== undefined ? `${rank} / ${total}` : `${rank}`}
    >
      {rank}
    </div>
  );
}
