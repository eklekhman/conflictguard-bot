"use client";

import { useEffect, useMemo, useState } from "react";
import type { RiskLevel } from "@/lib/conflictAnalyzer";

export interface MessageDto {
  id: number;
  chatId: string;
  username: string | null;
  text: string;
  score: number;
  risk: RiskLevel;
  createdAt: string;
}

export interface HeatmapDto {
  chatId: string;
  avgScore: number;
  msgCount: number;
}

interface Props {
  initialMessages: MessageDto[];
  initialHeatmap: HeatmapDto[];
  initialChatId?: string;
}

const RISK_LABELS: Record<RiskLevel, string> = {
  LOW: "Низкий",
  MEDIUM: "Средний",
  HIGH: "Высокий",
};

const RISK_CLASS: Record<RiskLevel, string> = {
  LOW: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  MEDIUM:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  HIGH: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}

export function DashboardClient({
  initialMessages,
  initialHeatmap,
  initialChatId,
}: Props) {
  const [messages, setMessages] = useState<MessageDto[]>(initialMessages);
  const [heatmap, setHeatmap] = useState<HeatmapDto[]>(initialHeatmap);
  const [selectedChatId, setSelectedChatId] = useState<string>(
    initialChatId ?? ""
  );

  const filteredMessages = useMemo(
    () =>
      selectedChatId
        ? messages.filter((m) => m.chatId === selectedChatId)
        : messages,
    [messages, selectedChatId]
  );

  useEffect(() => {
    let stopped = false;
    let eventSource: EventSource | null = null;

    const getMaxId = () =>
      messages.length > 0 ? Math.max(...messages.map((m) => m.id)) : 0;

    const connect = () => {
      if (stopped) return;

      const params = new URLSearchParams();
      const maxId = getMaxId();
      if (maxId > 0) params.set("sinceId", String(maxId));
      if (selectedChatId) params.set("chat", selectedChatId);

      eventSource = new EventSource(`/api/events?${params.toString()}`);

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            data: MessageDto;
          };
          if (payload.type !== "message") return;

          setMessages((prev) => {
            const exists = prev.some((m) => m.id === payload.data.id);
            if (exists) return prev;
            const next = [...prev, payload.data].sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );

            setHeatmap((prevHeatmap) => {
              const idx = prevHeatmap.findIndex(
                (h) => h.chatId === payload.data.chatId
              );
              if (idx === -1) {
                return [
                  ...prevHeatmap,
                  { chatId: payload.data.chatId, avgScore: payload.data.score, msgCount: 1 },
                ];
              }
              const current = prevHeatmap[idx];
              const total = current.avgScore * current.msgCount + payload.data.score;
              const msgCount = current.msgCount + 1;
              const avgScore = total / msgCount;
              const copy = [...prevHeatmap];
              copy[idx] = { ...current, avgScore, msgCount };
              return copy.sort((a, b) => b.avgScore - a.avgScore);
            });

            return next;
          });
        } catch {
          // ignore malformed events
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!stopped) {
          setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChatId]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">ConflictGuard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Мониторинг токсичности в Telegram-чатах в реальном времени
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-zinc-500 dark:text-zinc-400">
            Фильтр по чату:
          </label>
          <input
            value={selectedChatId}
            onChange={(e) => setSelectedChatId(e.target.value.trim())}
            placeholder="Например, 505019574"
            className="rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
          />
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Последние сообщения
            </h2>
            {filteredMessages.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Нет сообщений. Напишите что-нибудь в чат с ботом, чтобы увидеть
                данные здесь.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-zinc-200 dark:border-zinc-700 text-xs uppercase text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-2 py-1">Chat ID</th>
                      <th className="px-2 py-1">User</th>
                      <th className="px-2 py-1">Message</th>
                      <th className="px-2 py-1">Score</th>
                      <th className="px-2 py-1">Risk</th>
                      <th className="px-2 py-1">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMessages.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-zinc-100 dark:border-zinc-800 align-top"
                      >
                        <td className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {m.chatId}
                        </td>
                        <td className="px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400">
                          {m.username ? `@${m.username}` : "Unknown"}
                        </td>
                        <td className="px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 max-w-xs">
                          {truncate(m.text, 140)}
                        </td>
                        <td className="px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200">
                          {m.score}
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_CLASS[m.risk]}`}
                          >
                            {RISK_LABELS[m.risk]}
                          </span>
                        </td>
                        <td className="px-2 py-1 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Heatmap токсичности по чатам
            </h2>
            {heatmap.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Ещё нет статистики по чатам.
              </p>
            ) : (
              <ul className="space-y-2">
                {heatmap.map((h) => (
                  <li
                    key={h.chatId}
                    className="flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    <span className="truncate">Чат {h.chatId}</span>
                    <span className="ml-2 tabular-nums">
                      {h.avgScore.toFixed(1)} / 100 · {h.msgCount} msg
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

