interface ScoreBadgeProps {
  scoreA: number;
  scoreB: number;
  isVictory: boolean;
}

export function ScoreBadge({ scoreA, scoreB, isVictory }: ScoreBadgeProps) {
  const colorClass = isVictory
    ? "bg-success-light text-success"
    : "bg-error-light text-error";

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${colorClass}`}>
      {scoreA} - {scoreB}
    </span>
  );
}
