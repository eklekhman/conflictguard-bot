 "use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { RiskLevel } from "@/lib/conflictAnalyzer";

interface StoredAlert {
  id: string;
  timestamp: string;
  chatId: number;
  chatTitle?: string;
  authorId: number;
  authorUsername?: string;
  authorFirstName?: string;
  messageText: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};

const RISK_CLASS: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<StoredAlert[]>([]);
  const [filter, setFilter] = useState<RiskLevel | "">("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter) params.set("riskLevel", filter);
    params.set("limit", "50");
    fetch(`/api/alerts?${params}`)
      .then((res) => res.json())
      .then((data) => setAlerts(data.alerts ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">ConflictGuard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Алерты по риску конфликта в чатах
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:underline"
          >
            На главную
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Уровень риска:
          </span>
          <select
            value={filter}
            onChange={(e) => setFilter((e.target.value || "") as RiskLevel | "")}
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          >
            <option value="">Все</option>
            <option value="LOW">Низкий</option>
            <option value="MEDIUM">Средний</option>
            <option value="HIGH">Высокий</option>
          </select>
        </div>

        {loading ? (
          <p className="text-zinc-500 dark:text-zinc-400">Загрузка…</p>
        ) : alerts.length === 0 ? (
          <p className="text-zinc-500 dark:text-zinc-400">
            Нет алертов. Отправьте сообщения в чат с ботом, чтобы увидеть их здесь.
          </p>
        ) : (
          <ul className="space-y-4">
            {alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <time
                    dateTime={a.timestamp}
                    className="text-xs text-zinc-500 dark:text-zinc-400"
                  >
                    {new Date(a.timestamp).toLocaleString()}
                  </time>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${RISK_CLASS[a.riskLevel]}`}
                  >
                    {RISK_LABELS[a.riskLevel]} ({a.riskScore})
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {a.chatTitle ?? `Чат ${a.chatId}`} ·{" "}
                    {a.authorUsername ? `@${a.authorUsername}` : a.authorFirstName ?? a.authorId}
                  </span>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 break-words">
                  {truncate(a.messageText, 300)}
                </p>
                {a.reasons.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {a.reasons.join("; ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
