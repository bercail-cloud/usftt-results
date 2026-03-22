interface RankCircleProps {
  rank: number;
  total?: number;
}

function getRankColorClass(rank: number): string {
  if (rank === 1) return "bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300"; // or
  if (rank === 2) return "bg-gray-100 text-gray-500 ring-1 ring-gray-300"; // argent
  if (rank <= 4) return "bg-amber-100 text-amber-700 ring-1 ring-amber-300"; // bronze
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
