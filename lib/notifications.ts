/**
 * Sends private Telegram alerts to managers when conflict risk is high.
 */

import { config } from "./config";
import type { StoredAlert } from "./alertsStore";

const TELEGRAM_API = "https://api.telegram.org/bot";

function buildAlertMessage(alert: StoredAlert): string {
  const author = alert.authorUsername
    ? `@${alert.authorUsername}`
    : alert.authorFirstName ?? `ID ${alert.authorId}`;
  const chat = alert.chatTitle ?? `Chat ${alert.chatId}`;
  const textPreview =
    alert.messageText.length > 200
      ? alert.messageText.slice(0, 200) + "..."
      : alert.messageText;

  return [
    "⚠️ ConflictGuard: повышенный риск конфликта",
    "",
    `Чат: ${chat}`,
    `Автор: ${author}`,
    `Уровень: ${alert.riskLevel} (${alert.riskScore}/100)`,
    "",
    "Сообщение:",
    textPreview,
    "",
    "Рекомендация: проверьте тон диалога и при необходимости вмешайтесь до эскалации.",
  ].join("\n");
}

export async function notifyManagers(alert: StoredAlert): Promise<void> {
  const token = config.telegramBotToken;
  if (!token) return;

  const text = buildAlertMessage(alert);
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  for (const chatId of config.managerIds) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error(`[ConflictGuard] Failed to notify manager ${chatId}:`, err);
      }
    } catch (e) {
      console.error(`[ConflictGuard] Error notifying manager ${chatId}:`, e);
    }
  }
}
