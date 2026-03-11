import { NextRequest, NextResponse } from "next/server";
import type { RiskLevel } from "@/lib/conflictAnalyzer";
import { analyze } from "@/lib/conflictAnalyzer";
import { insertMessage } from "@/lib/db";
import { sendManagerAlert, sendRiskSummaryToChat } from "@/lib/telegram";

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

export const runtime = "nodejs";

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

    console.log(
      "[ConflictGuard] Text after fix:",
      JSON.stringify(text),
      "hasCyrillic:",
      /[а-яё]/.test(text)
    );

    const analysis = analyze(text);

    console.log("[ConflictGuard] Analysis debug", {
      text,
      analysis,
    });

    const chatIdStr = String(chat.id);
    const userIdStr = from?.id ? String(from.id) : null;
    const username = from?.username ?? null;

    await insertMessage({
      chatId: chatIdStr,
      userId: userIdStr,
      username,
      text,
      score: analysis.score,
      risk: analysis.risk as RiskLevel,
    });

    await sendRiskSummaryToChat(chat.id, analysis);

    if (analysis.score > 70) {
      await sendManagerAlert({
        chatId: chat.id,
        username,
        text,
        score: analysis.score,
        risk: analysis.risk,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ConflictGuard] Webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}
