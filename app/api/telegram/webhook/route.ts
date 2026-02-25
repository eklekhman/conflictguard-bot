/**
 * Telegram Webhook: receives updates, runs conflict analysis, stores alerts, notifies managers on HIGH.
 */

import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TelegramUpdate;
    const text = getMessageText(body);
    if (text === null) {
      return NextResponse.json({ ok: true });
    }

    const message = body.message!;
    const from = message.from ?? { id: 0 };
    const chat = message.chat;

    const analysis = analyzeMessage(text);

    console.log("[ConflictGuard] Analysis debug", {
      text,
      analysis,
    });

    const alert = addAlert({
      chatId: chat.id,
      chatTitle: chat.title,
      authorId: from.id,
      authorUsername: from.username,
      authorFirstName: from.first_name,
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
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}
