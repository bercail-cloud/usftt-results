interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center py-12 px-4">
      <p className="text-text-muted text-center">{message}</p>
    </div>
  );
}
