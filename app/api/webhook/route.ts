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
  конфликт: 30, война: 40, драка: 50,
  убью: 90, зарежу: 95, заебал: 75
};

// 🔥 ИДЕАЛЬНАЯ функция анализа
function analyzeConflict(text: string, chatId: number): { 
  score: number; risk: string; word?: string; matCount: number 
} {
  const lower = text.toLowerCase();
  let baseScore = 0;
  let matchedWord: string | undefined;
  let matCount = 0;

  // 🔥 ТОЧНЫЙ поиск МАТА (полные слова)
  for (const [word, points] of Object.entries(MAT_SCORE)) {
    // \b = граница слова (точно "дебил", не "дебильный")
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      baseScore = points;
      matchedWord = word;
      break;
    }
  }

  // Подсчет повторов
  if (matchedWord) {
    matCount = (lower.match(new RegExp(matchedWord, 'gi')) || []).length;
  }

  // 🔥 Бонусы ТОЛЬКО при мате
  let bonusScore = 0;
  if (baseScore > 0) {
    bonusScore = (text.match(/[А-ЯЪЫЬЭ]{3,}/g) || []).length * 10 + 
                 (text.match(/[!]{2,}/g) || []).length * 8;
  }

  const finalScore = Math.min(baseScore * matCount + bonusScore, 100);

  console.log(`🔍 "${text}" → ${finalScore}% (${matchedWord || 'clean'} ${baseScore > 0 ? `×${matCount} +${bonusScore}` : ''})`);

  const risk = finalScore > 80 ? "🔥 HIGH" : 
               finalScore > 50 ? "🚨 MEDIUM" : 
               finalScore > 25 ? "⚠️ LOW" : "✅ OK";
  
  return { score: finalScore, risk, word: matchedWord, matCount };
}

export async function POST(request: NextRequest) {
  console.log("📨 POST /api/webhook");

  try {
    const body = await request.json();
    const chatId = Number(body.message?.chat?.id);
    const user = body.message?.from?.username || body.message?.from?.first_name || "unknown";
    const text = body.message?.text || "";
    const messageId = body.message?.message_id;

    // История чата
    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`👤 ${user} [${chatId}]: "${text}"`);

    if (text) {
      const { score, risk, word, matCount } = analyzeConflict(text, chatId);
      
      // ✅ ЛОГИРУЕМ ВСЕ В DASHBOARD (даже 0%)
      try {
        addStat(word || text.slice(0, 30), score);
      } catch (e) {
        console.log('⚠️ addStat:', e.message);
      }

      // 🔥 ТВЁРДОЕ условие: УВЕДОМЛЕНИЯ ТОЛЬКО > 25!
      if (score > 25 && baseScore > 0) {  // baseScore > 0 = НАЙДЕН МАТ!
        console.log(`⚡ АЛАРМ ${risk}! ${score}% "${text}"`);
        
        const ADMIN_CHAT_ID = 505019574;
        const emoji = score > 80 ? "🔥" : score > 50 ? "🚨" : "⚠️";
        
        await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: `${emoji} CONFLICTGUARD | ${risk}\n👤 ${user} [${chatId}]\n💬 "${text}"\n⚡ ${Math.round(score)}% | ${word} ×${matCount}`
          })
        }).catch(err => console.error('❌ Админ:', err));
      } else {
        console.log(`✅ OK: ${score}% "${text}" (no action)`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ ERROR:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}