import { sql } from "@vercel/postgres";
import type { RiskLevel } from "./conflictAnalyzer";

const hasDatabase = Boolean(process.env.POSTGRES_URL);

export interface MessageRow {
  id: number;
  chatId: string;
  userId: string | null;
  username: string | null;
  text: string;
  score: number;
  risk: RiskLevel;
  createdAt: Date;
}

export interface ChatHeatmapRow {
  chatId: string;
  avgScore: number;
  msgCount: number;
}

let schemaInitialized = false;

async function ensureSchema() {
  if (schemaInitialized || !hasDatabase) return;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      chat_id BIGINT NOT NULL,
      user_id BIGINT NULL,
      username TEXT NULL,
      text TEXT NOT NULL,
      score INTEGER NOT NULL,
      risk TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at
      ON messages (chat_id, created_at DESC);
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_messages_created_at
      ON messages (created_at DESC);
  `;

  schemaInitialized = true;
}

export async function insertMessage(log: {
  chatId: string;
  userId?: string | null;
  username?: string | null;
  text: string;
  score: number;
  risk: RiskLevel;
  createdAt?: Date;
}): Promise<void> {
  if (!hasDatabase) {
    console.log("[ConflictGuard][insertMessage] DB disabled, skipping insert", {
      chatId: log.chatId,
      score: log.score,
      risk: log.risk,
    });
    return;
  }

  await ensureSchema();

  const createdAt = log.createdAt ?? new Date();

  await sql`
    INSERT INTO messages (chat_id, user_id, username, text, score, risk, created_at)
    VALUES (${log.chatId}, ${log.userId}, ${log.username}, ${log.text}, ${log.score}, ${log.risk}, ${createdAt})
  `;
}

export async function getRecentMessages(
  limit: number = 50,
  chatId?: string
): Promise<MessageRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);

  if (!hasDatabase) {
    console.log("🛠️ Dev mode: БД отключена → Live статистика");
    const { getStats } = await import("./stats");
    const liveStats = getStats();

    const severityToScore = (s: string): number =>
      s === "HIGH" ? 80 : s === "MEDIUM" ? 50 : 25;

    const rows: MessageRow[] = liveStats
      .map((stat, i) => ({
        id: i + 1,
        chatId: "live",
        userId: null as string | null,
        username: "@live",
        text: `${stat.word} (×${stat.count})`,
        score: severityToScore(stat.severity),
        risk: stat.severity as RiskLevel,
        createdAt: new Date(stat.createdAt),
      }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const filtered = chatId
      ? rows.filter((m) => m.chatId === chatId)
      : rows;

    return filtered.slice(0, safeLimit);
  }

  await ensureSchema();

  const result = chatId
    ? await sql<{
        id: number;
        chat_id: string;
        user_id: string | null;
        username: string | null;
        text: string;
        score: number;
        risk: RiskLevel;
        created_at: Date;
      }>`
        SELECT id, chat_id, user_id, username, text, score, risk, created_at
        FROM messages
        WHERE chat_id = ${chatId}
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `
    : await sql<{
        id: number;
        chat_id: string;
        user_id: string | null;
        username: string | null;
        text: string;
        score: number;
        risk: RiskLevel;
        created_at: Date;
      }>`
        SELECT id, chat_id, user_id, username, text, score, risk, created_at
        FROM messages
        ORDER BY created_at DESC
        LIMIT ${safeLimit}
      `;

  return result.rows.map((row) => ({
    id: row.id,
    chatId: String(row.chat_id),
    userId: row.user_id ? String(row.user_id) : null,
    username: row.username,
    text: row.text,
    score: row.score,
    risk: row.risk,
    createdAt: row.created_at,
  }));
}

export async function getMessagesSince(sinceId: number): Promise<MessageRow[]> {
  if (!hasDatabase) {
    return [];
  }

  await ensureSchema();

  const result = await sql<{
    id: number;
    chat_id: string;
    user_id: string | null;
    username: string | null;
    text: string;
    score: number;
    risk: RiskLevel;
    created_at: Date;
  }>`
    SELECT id, chat_id, user_id, username, text, score, risk, created_at
    FROM messages
    WHERE id > ${sinceId}
    ORDER BY id ASC
    LIMIT 200
  `;

  return result.rows.map((row) => ({
    id: row.id,
    chatId: String(row.chat_id),
    userId: row.user_id ? String(row.user_id) : null,
    username: row.username,
    text: row.text,
    score: row.score,
    risk: row.risk,
    createdAt: row.created_at,
  }));
}

export async function getChatHeatmap(): Promise<ChatHeatmapRow[]> {
  if (!hasDatabase) {
    console.log("🛠️ Dev mode: БД отключена → Mock heatmap");
    return [
      { chatId: "505019574", avgScore: 60, msgCount: 4 },
      { chatId: "123456789", avgScore: 25, msgCount: 1 },
    ];
  }

  await ensureSchema();

  const result = await sql<{
    chat_id: string;
    avg_score: number;
    msg_count: number;
  }>`
    SELECT
      chat_id,
      AVG(score)::float AS avg_score,
      COUNT(*)::int AS msg_count
    FROM messages
    GROUP BY chat_id
    ORDER BY avg_score DESC
  `;

  return result.rows.map((row) => ({
    chatId: String(row.chat_id),
    avgScore: row.avg_score,
    msgCount: row.msg_count,
  }));
}

