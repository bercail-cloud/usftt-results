import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

interface SyncJob {
  job_name: string;
  last_run: string;
  status: string;
  error_message?: string | null;
}

interface SyncLog {
  id: number;
  job_name: string;
  level: string;
  message: string;
  details: string | null;
  created_at: string;
}

interface SyncLogsResponse {
  logs: SyncLog[];
}

interface SyncStatusResponse {
  jobs: SyncJob[];
  activeSyncs: string[];
}

const JOB_DETAILS: Record<string, { label: string; description: string; schedule: string; apis: string[] }> = {
  "sync-equipes": {
    label: "Equipes",
    description: "Liste des equipes du club",
    schedule: "Hebdo / debut de phase",
    apis: ["xml_equipe"],
  },
  "sync-joueurs": {
    label: "Joueurs",
    description: "Fiches joueurs (classement, licence, type)",
    schedule: "Hebdo / debut de phase",
    apis: ["xml_licence_b"],
  },
  "sync-classements": {
    label: "Classements + Rencontres",
    description: "Classement poule, matchs par equipe, et details (parties par rencontre)",
    schedule: "Quotidien 7h/19h + samedi toutes les heures (si match prevu)",
    apis: ["xml_result_equ", "xml_result_equ?action=classement", "xml_chp_renc"],
  },
  "sync-parties-spid": {
    label: "Parties SPID",
    description: "Parties individuelles recentes (enrichit les donnees mysql + ajoute les matchs pas encore dans mysql)",
    schedule: "Quotidien 7h/19h + samedi toutes les heures (si match prevu)",
    apis: ["xml_partie"],
  },
  "sync-parties-mysql": {
    label: "Parties MySQL",
    description: "Parties individuelles officielles (source de reference, delete + re-insert)",
    schedule: "Du 12 au 20 de chaque mois a 6h",
    apis: ["xml_partie_mysql"],
  },
  "sync-historique": {
    label: "Historique classement",
    description: "Historique des classements par saison/phase",
    schedule: "Hebdo lundi 6h / tous les 2 jours en janvier et septembre",
    apis: ["xml_histo_classement"],
  },
  "sync-criterium": {
    label: "Criterium",
    description: "Tournois criterium (4 organismes : national, zone, regional, departemental)",
    schedule: "Manuel uniquement",
    apis: ["xml_epreuve", "xml_division", "xml_result_indiv?action=poule", "xml_result_indiv?action=classement", "xml_result_indiv?action=partie"],
  },
};

const GROUPED_JOBS = [
  {
    group: "syncQuotidienEtJourDeMatch",
    label: "Quotidien + Jour de match",
    schedule: "Tous les jours 7h/19h + samedi toutes les heures (si match prevu)",
    jobs: ["sync-classements", "sync-parties-spid"],
  },
  {
    group: "syncPartiesMysql",
    label: "Parties MySQL (mensuel)",
    schedule: "Du 12 au 20 de chaque mois a 6h",
    jobs: ["sync-parties-mysql"],
  },
  {
    group: "syncHebdoEtDebutPhaseBiQuotidien",
    label: "Hebdo + Debut de phase",
    schedule: "Lundi 6h (fev-aout, oct-dec) / tous les 2 jours en janvier et septembre",
    jobs: ["sync-equipes", "sync-joueurs", "sync-historique"],
  },
  {
    group: "syncFull (manuel)",
    label: "Sync complet (manuel)",
    schedule: "POST /api/sync/trigger/full",
    jobs: ["sync-equipes", "sync-joueurs", "sync-classements", "sync-parties-spid"],
  },
  {
    group: "syncCriterium (manuel)",
    label: "Criterium (manuel)",
    schedule: "POST /api/sync/trigger/criterium",
    jobs: ["sync-criterium"],
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusBadge(status: string, isActive: boolean) {
  if (isActive) {
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">En cours...</span>;
  }
  if (status === "success") {
    return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">OK</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">Erreur</span>;
}

function timeSince(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}j`;
}

function levelColor(level: string): string {
  if (level === "error") return "text-red-700 bg-red-50";
  if (level === "warn") return "text-amber-700 bg-amber-50";
  return "text-blue-700 bg-blue-50";
}

function SyncLogs({ jobName }: { jobName: string }) {
  const { data, isLoading } = useQuery<SyncLogsResponse>({
    queryKey: ["sync-logs", jobName],
    queryFn: () => api.get(`/api/sync/logs/${jobName}`),
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="text-text-secondary text-sm p-4">Chargement...</div>;

  const logs = data?.logs ?? [];
  if (logs.length === 0) return <div className="text-text-secondary text-sm p-4">Aucun log</div>;

  return (
    <div className="max-h-96 overflow-y-auto divide-y divide-border">
      {logs.map((log) => (
        <div key={log.id} className="px-4 py-2 text-xs space-y-0.5">
          <div className="flex items-center gap-2">
            <span className={`px-1.5 py-0.5 rounded font-medium ${levelColor(log.level)}`}>
              {log.level}
            </span>
            <span className="text-text-secondary">{formatDate(log.created_at)}</span>
          </div>
          <div className="text-text-primary">{log.message}</div>
          {log.details && (
            <details className="text-text-secondary">
              <summary className="cursor-pointer hover:text-text-primary">Details</summary>
              <pre className="mt-1 whitespace-pre-wrap text-[10px] bg-bg-card p-2 rounded">{log.details}</pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export function Sync() {
  const [showLogs, setShowLogs] = useState<string | null>(null);
  const { data, isLoading } = useQuery<SyncStatusResponse>({
    queryKey: ["sync-status"],
    queryFn: () => api.get("/api/sync/status"),
    refetchInterval: 10000,
  });

  const jobsByName = new Map(data?.jobs.map((j) => [j.job_name, j]) ?? []);
  const activeSyncs = new Set(data?.activeSyncs ?? []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold text-text-primary">Synchronisation FFTT</h1>

      {/* Status table */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Dernier statut des jobs</h2>
        {isLoading ? (
          <div className="text-text-secondary text-sm">Chargement...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-bg-card">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Job</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Statut</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary">Dernier run</th>
                  <th className="text-left px-3 py-2 font-medium text-text-secondary hidden sm:table-cell">Il y a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.entries(JOB_DETAILS).map(([jobName, detail]) => {
                  const job = jobsByName.get(jobName);
                  const isActive = activeSyncs.has(jobName);
                  return (
                    <tr key={jobName} className="hover:bg-bg-card/50">
                      <td className="px-3 py-2 font-medium text-text-primary">{detail.label}</td>
                      <td className="px-3 py-2">
                        {job ? statusBadge(job.status, isActive) : (
                          <span className="text-text-secondary text-xs">Jamais execute</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-text-secondary">
                        {job ? formatDate(job.last_run) : "-"}
                      </td>
                      <td className="px-3 py-2 text-text-secondary hidden sm:table-cell">
                        {job ? timeSince(job.last_run) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Job details / documentation */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Planification</h2>
        <div className="space-y-4">
          {GROUPED_JOBS.map((group) => (
            <div key={group.group} className="border border-border rounded-lg overflow-hidden">
              <div className="bg-bg-card px-4 py-3">
                <div className="font-semibold text-text-primary">{group.label}</div>
                <div className="text-xs text-text-secondary mt-0.5">{group.schedule}</div>
              </div>
              <div className="divide-y divide-border">
                {group.jobs.map((jobName) => {
                  const detail = JOB_DETAILS[jobName];
                  if (!detail) return null;
                  return (
                    <div key={jobName} className="px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-text-primary">{detail.label}</span>
                        <span className="text-xs text-text-secondary font-mono">{jobName}</span>
                      </div>
                      <div className="text-xs text-text-secondary">{detail.description}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {detail.apis.map((endpoint) => (
                          <span
                            key={endpoint}
                            className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200"
                          >
                            {endpoint}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Logs */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Logs</h2>
        <div className="flex gap-2">
          {["sync-criterium"].map((job) => (
            <button
              key={job}
              onClick={() => setShowLogs(showLogs === job ? null : job)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                showLogs === job
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-text-secondary hover:text-text-primary hover:bg-border-light"
              }`}
            >
              {job}
            </button>
          ))}
        </div>
        {showLogs && (
          <div className="border border-border rounded-lg overflow-hidden">
            <SyncLogs jobName={showLogs} />
          </div>
        )}
      </section>
    </div>
  );
}
