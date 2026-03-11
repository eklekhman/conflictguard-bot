import { NextRequest } from "next/server";
import { getMessagesSince, getRecentMessages } from "@/lib/db";

export const runtime = "nodejs";

const STREAM_DURATION_MS = 25_000;
const POLL_INTERVAL_MS = 3_000;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sinceIdParam = searchParams.get("sinceId");
  const chatId = searchParams.get("chat") ?? undefined;

  const sinceId = sinceIdParam ? Number.parseInt(sinceIdParam, 10) || 0 : 0;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let lastId = sinceId;
      let closed = false;

      const send = (data: unknown) => {
        if (closed) return;
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      const sendMessages = (rows: Awaited<ReturnType<typeof getRecentMessages>>) => {
        for (const row of rows) {
          lastId = Math.max(lastId, row.id);
          send({
            type: "message",
            data: {
              id: row.id,
              chatId: row.chatId,
              username: row.username,
              text: row.text,
              score: row.score,
              risk: row.risk,
              createdAt: row.createdAt.toISOString(),
            },
          });
        }
      };

      // Основной асинхронный цикл опроса БД
      (async () => {
        try {
          if (lastId === 0) {
            const initial = await getRecentMessages(50, chatId);
            sendMessages(initial.reverse());
          }

          const endAt = Date.now() + STREAM_DURATION_MS;

          while (!closed && Date.now() < endAt) {
            const newer = await getMessagesSince(lastId);
            if (newer.length > 0) {
              const filtered = chatId
                ? newer.filter((m) => m.chatId === chatId)
                : newer;
              sendMessages(filtered);
            }

            await new Promise((resolve) =>
              setTimeout(resolve, POLL_INTERVAL_MS)
            );
          }
        } catch (err) {
          console.error("[ConflictGuard] SSE stream error:", err);
        } finally {
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed (e.g. by abort)
          }
        }
      })();

      const abort = request.signal;
      abort.addEventListener("abort", () => {
        closed = true;
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

