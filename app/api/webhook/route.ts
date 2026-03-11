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
  сука: 65,
  пиздец: 80, блять: 70, хуй: 85,
  нахуй: 95, "пошел нахуй": 100,
  конфликт: 30, война: 40, драка: 50,
  убью: 90, зарежу: 95, заебал: 75
};

function analyzeConflict(text: string, chatId: number): { 
  score: number; 
  risk: string; 
  word?: string; 
  matCount: number 
} {
  const lower = text.toLowerCase();
  let baseScore = 0;
  let matchedWord: string | undefined;
  let matCount = 0;

  // 🔥 ТОЧНЫЙ поиск МАТА (полные слова)
  for (const [word, points] of Object.entries(MAT_SCORE)) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'i');
    if (regex.test(lower)) {
      baseScore = points;
      matchedWord = word;
      break;
    }
  }

  if (matchedWord) {
    matCount = (lower.match(new RegExp(matchedWord, 'gi')) || []).length;
  }

  let bonusScore = 0;
  if (baseScore > 0) {
    bonusScore = (text.match(/[А-ЯЪЫЬЭ]{3,}/g) || []).length * 10 + 
                 (text.match(/[!]{2,}/g) || []).length * 8;
  }

  const finalScore = Math.min(baseScore * matCount + bonusScore, 100);

  console.log(`🔍 "${text}" → ${finalScore}% (${matchedWord || 'clean'})`);

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

    // История чата
    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`👤 ${user} [${chatId}]: "${text}"`);

    if (text) {
      const { score, risk, word, matCount } = analyzeConflict(text, chatId);
      
      // ✅ ЛОГИРУЕМ ВСЕ В DASHBOARD (статистика)
      try {
        addStat(word || text.slice(0, 30), score);
      } catch (e: unknown) {
        console.log('⚠️ addStat:', (e as Error).message);
      }

      // 🔥 🔥 ТВЁРДОЕ условие: НИКАКИХ АЛЕРТОВ на 0%!
      if (score > 25 && word && score > 0) {  // ✅ ТРОЙНАЯ ЗАЩИТА!
        console.log(`⚡ АЛАРМ ${risk}! ${score}% "${text}"`);
        
        // ✅ ✅ ✅ ИСПРАВЛЕНО: используем ENV вместо hardcode!
        const ADMIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
        if (!ADMIN_CHAT_ID) {
          console.error("❌ TELEGRAM_CHAT_ID не найден в ENV!");
          return NextResponse.json({ ok: true });
        }
        
        const token = process.env.TELEGRAM_TOKEN;
        if (!token) {
          console.error("❌ TELEGRAM_TOKEN не найден!");
          return NextResponse.json({ ok: true });
        }
        
        const emoji = score > 80 ? "🔥" : score > 50 ? "🚨" : "⚠️";
        
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: `${emoji} CONFLICTGUARD | ${risk}\n👤 ${user} [${chatId}]\n💬 "${text}"\n⚡ ${Math.round(score)}% | ${word} ×${matCount}`
          })
        }).catch(err => console.error('❌ Уведомление:', err));
      } else {
        console.log(`✅ OK: ${score}% "${text}" (no alert)`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ ERROR:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}