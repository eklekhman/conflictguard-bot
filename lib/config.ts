/**
 * ConflictGuard config: env and manager IDs for private alerts.
 */

function parseManagerIds(value: string | undefined): number[] {
  if (!value?.trim()) return [];
  return value
    .split(",")
    .map((id) => parseInt(id.trim(), 10))
    .filter((n) => !Number.isNaN(n));
}

export const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",
  managerIds: parseManagerIds(process.env.MANAGER_IDS),
} as const;
