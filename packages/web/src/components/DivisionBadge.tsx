interface DivisionBadgeProps {
  division: string;
}

function getDivisionColorClass(division: string): string {
  const code = division.trim().toUpperCase();
  if (code.startsWith("N")) {
    return "bg-primary-light text-primary";
  }
  if (code.startsWith("D")) {
    return "bg-amber-100 text-amber-700";
  }
  if (code.startsWith("P") || code.startsWith("R")) {
    return "bg-indigo-100 text-indigo-600";
  }
  return "bg-border-light text-text-secondary";
}

export function DivisionBadge({ division }: DivisionBadgeProps) {
  const colorClass = getDivisionColorClass(division);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
    >
      {division}
    </span>
  );
}
