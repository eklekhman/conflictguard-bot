import { getChatHeatmap, getRecentMessages } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  searchParams: Promise<{
    chat?: string;
  }>;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const chatId = params.chat ?? undefined;
  const [messages, heatmap] = await Promise.all([
    getRecentMessages(50, chatId),
    getChatHeatmap(),
  ]);

  const initialMessages = messages.map((m) => ({
    id: m.id,
    chatId: m.chatId,
    username: m.username,
    text: m.text,
    score: m.score,
    risk: m.risk,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <DashboardClient
      initialMessages={initialMessages}
      initialHeatmap={heatmap}
      initialChatId={chatId}
    />
  );
}
