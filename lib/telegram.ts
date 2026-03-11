import TelegramBot from "node-telegram-bot-api";
import type { AnalysisResult, RiskLevel } from "./conflictAnalyzer";

const token = process.env.TELEGRAM_TOKEN;
const managerChatId = process.env.MANAGER_CHAT_ID;
const dashboardUrl = process.env.DASHBOARD_URL || "";

let bot: TelegramBot | null = null;

function getBotInstance(): TelegramBot | null {
  if (!token) {
    console.warn("[ConflictGuard] TELEGRAM_TOKEN is not set");
    return null;
  }

  if (!bot) {
    bot = new TelegramBot(token, { polling: false });
  }

  return bot;
}

export async function sendManagerAlert(params: {
  chatId: number | string;
  username?: string | null;
  text: string;
  score: number;
  risk: RiskLevel;
}): Promise<void> {
  const botInstance = getBotInstance();
  if (!botInstance) return;

  if (!managerChatId) {
    console.warn("[ConflictGuard] MANAGER_CHAT_ID is not set");
    return;
  }

  const { chatId, username, text, score, risk } = params;
  const displayUser = username ? `@${username}` : "Unknown user";
  const safeText =
    text.length > 300 ? text.slice(0, 297).trimEnd() + "…" : text;

  const linkChatId = String(chatId);
  const linkBase = dashboardUrl || "";
  const link =
    linkBase && linkBase.endsWith("/")
      ? `${linkBase}dashboard?chat=${linkChatId}`
      : `${linkBase}/dashboard?chat=${linkChatId}`;

  const messageLines = [
    `⚠️ Конфликт в чате #${linkChatId}`,
    `${displayUser}: "${safeText}" [${score}/100, ${risk}]`,
    linkBase ? link : "",
  ].filter(Boolean);

  await botInstance.sendMessage(managerChatId, messageLines.join("\n"), {
    disable_web_page_preview: true,
  });
}

export async function sendRiskSummaryToChat(
  chatId: number | string,
  analysis: Pick<AnalysisResult, "score" | "risk" | "reasons">
): Promise<void> {
  const botInstance = getBotInstance();
  if (!botInstance) return;

  const { score, risk, reasons } = analysis;
  const bodyLines = [
    `⚠️ Риск конфликта: ${risk}`,
    `Баллы: ${score}`,
  ];

  if (reasons.length > 0) {
    bodyLines.push(reasons.join(", "));
  }

  await botInstance.sendMessage(chatId, bodyLines.join("\n"));
}


