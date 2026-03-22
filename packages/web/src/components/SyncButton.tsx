import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { RefreshCw } from "lucide-react";

interface SyncStatusResponse {
  jobs: Array<{ job_name: string; last_run: string; status: string }>;
  isSyncing: boolean;
}

export function SyncButton() {
  const [triggering, setTriggering] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery<SyncStatusResponse>({
    queryKey: ["sync-status"],
    queryFn: () => api.get("/api/sync/status"),
    refetchInterval: (query) => {
      const d = query.state.data;
      return d?.isSyncing ? 3000 : 30000;
    },
  });

  const isSyncing = data?.isSyncing ?? false;

  async function handleSync() {
    setTriggering(true);
    try {
      await api.post("/api/sync/trigger");
      // Refetch sync status and all data after a delay
      setTimeout(() => {
        queryClient.invalidateQueries();
      }, 5000);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <button
      onClick={handleSync}
      disabled={isSyncing || triggering}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-text-secondary hover:text-text-primary hover:bg-border-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      title={isSyncing ? "Synchronisation en cours..." : "Synchroniser les données"}
    >
      <RefreshCw
        size={14}
        className={isSyncing ? "animate-spin" : ""}
      />
      {isSyncing ? "Sync..." : "Sync"}
    </button>
  );
}
