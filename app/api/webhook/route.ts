import { NextRequest, NextResponse } from "next/server";
import { addStat } from "@/lib/stats";

// Глобальный кэш истории
declare global {
  var chatHistory: Map<number, { text: string; time: number }[]>;
}

if (!global.chatHistory) {
  global.chatHistory = new Map();
}

const MAT_SCORE: { [key: string]: number } = {
  дебил: 40, дебильный: 40, дебилизм: 40,
  кретин: 45, кретинизм: 45, 
  дурак: 25, дурацкий: 25,
  идиот: 50, идиотизм: 50,
  мудак: 60, мудаковатый: 60,
  пиздец: 80, блять: 70, хуй: 85,
  нахуй: 95, "пошел нахуй": 100,
};

function analyzeMat(text: string, chatId: number): { 
  score: number; risk: string; word?: string; matCount: number 
} {
  const lower = text.toLowerCase();
  let baseScore = 0;
  let matchedWord: string | undefined;
  let matCount = 0;

  // 1. Найди НАИБИЛЬШИЙ мат
  for (const [word, points] of Object.entries(MAT_SCORE)) {
    if (lower.includes(word)) {
      baseScore = points;
      matchedWord = word;
      break;
    }
  }

  // 2. Простой подсчет ТОГО ЖЕ слова!
  if (matchedWord) {
    matCount = (lower.match(new RegExp(matchedWord, 'g')) || []).length;
  }

  // 3. Линейный риск: count × base
  const finalScore = baseScore * matCount; 

  console.log(`🔍 "${text}" ×${matCount} → ${finalScore} (${baseScore}×${matCount})`);

  const risk = finalScore > 80 ? "HIGH" : finalScore > 50 ? "MEDIUM" : "LOW";
  return { score: finalScore, risk, word: matchedWord, matCount };
}

export async function POST(request: NextRequest) {
  console.log("📨 POST /api/webhook 200");

  try {
    const body = await request.json();
    const chatId = Number(body.message?.chat?.id);
    const user = body.message?.from?.username || "unknown";
    const text = body.message?.text || "";

    // История чата
    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`👤 ${user} [${chatId}]: "${text}" | История: ${history.length}`);

    if (text) {
      const { score, risk, word, matCount } = analyzeMat(text, chatId); // 🔥 matCount!
      
      if (score > 0) {
        console.log(`⚡ АЛАРМ! "${text}" → ${score} ${risk} | ×${matCount}`);
        addStat(word || text.slice(0, 30), score);
        
        // 🚨 УВЕДОМЛЕНИЕ АДМИНУ (только HIGH)
        if (score > 80) {
          const ADMIN_CHAT_ID = 505019574;
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: ADMIN_CHAT_ID,
              text: `🚨 CONFLICTGUARD АЛАРМ!\n👤 ${user} [${chatId}]\n💬 "${text}"\n⚡ РИСК: ${Math.round(score)} ${risk}\n📊 ${word || 'мат'} ×${matCount}` // 🔥 ТОЧНЫЙ count!
            })
          }).catch(err => console.error('❌ Админ уведомление:', err));
          
          console.log(`📱 Админ уведомлен: ${Math.round(score)} ${risk} ×${matCount}`);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ Webhook ERROR:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}