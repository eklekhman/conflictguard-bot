/**
 * Telegram Webhook: receives updates, runs conflict analysis, stores alerts, notifies managers on HIGH.
 * Node runtime + явный UTF-8 при чтении тела — чтобы кириллица работала на Vercel.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { analyzeMessage } from "@/lib/conflictAnalyzer";
import { addAlert } from "@/lib/alertsStore";
import { notifyManagers } from "@/lib/notifications";

interface TelegramMessage {
  message_id: number;
  from?: {
    id: number;
    first_name?: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

function getMessageText(update: TelegramUpdate): string | null {
  const msg = update.message;
  if (!msg?.text) return null;
  return msg.text;
}

/** Читаем тело строго как UTF-8 (фикс кириллицы на Vercel). */
async function parseBodyUtf8(request: NextRequest): Promise<TelegramUpdate> {
  const buffer = await request.arrayBuffer();
  const raw = new TextDecoder("utf-8").decode(buffer);
  return JSON.parse(raw) as TelegramUpdate;
}

/**
 * Исправление mojibake: когда UTF-8 байты были прочитаны как Latin-1 (часто на Vercel).
 * "дурак" (UTF-8) → при неправильной кодировке приходит как Ð´ÑƒÑ€Ð°Ðº.
 */
function fixMojibake(str: string): string {
  if (typeof str !== "string") return str;
  // Уже нормальная кириллица — не трогаем
  if (/[а-яёА-ЯЁ]/.test(str)) return str;
  // Похоже на mojibake: есть байты 0xD0/0xD1 (первые байты кириллицы в UTF-8), кириллицы нет
  if (/[\u00D0\u00D1]/.test(str)) {
    const bytes = new Uint8Array([...str].map((c) => c.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  }
  return str;
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseBodyUtf8(request);
    let text = getMessageText(body);
    if (text === null) {
      return NextResponse.json({ ok: true });
    }

    text = fixMojibake(text);

    const message = body.message;
    const chat = message?.chat;
    const from = message?.from;

    if (!chat?.id) {
      console.warn("[ConflictGuard] Skip: no chat.id in update");
      return NextResponse.json({ ok: true });
    }

    console.log("[ConflictGuard] Text after fix:", JSON.stringify(text), "hasCyrillic:", /[а-яё]/.test(text));

    const analysis = analyzeMessage(text);

    console.log("[ConflictGuard] Analysis debug", {
      text,
      analysis,
    });

    const alert = addAlert({
      chatId: chat.id,
      chatTitle: chat.title ?? "Private chat",
      authorId: from?.id ?? 0,
      authorUsername: from?.username ?? undefined,
      authorFirstName: from?.first_name ?? undefined,
      messageText: text,
      riskScore: analysis.riskScore,
      riskLevel: analysis.riskLevel,
      reasons: analysis.reasons,
    });

    if (analysis.riskLevel === "HIGH") {
      await notifyManagers(alert);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ConflictGuard] Webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}
