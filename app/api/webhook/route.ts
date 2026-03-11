import { NextRequest, NextResponse } from "next/server";
import { addStat } from "@/lib/stats";

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
  words: string[]; 
  matCount: number 
} {
  const lower = text.toLowerCase();
  let rawScore = 0;
  const foundWords: string[] = [];
  let matCount = 0;

  // 🔥 ПРОСТЫЙ .includes() + защита от подстрок БЕЗ regex!
  for (const [badWord, points] of Object.entries(MAT_SCORE)) {
    if (lower.includes(badWord)) {
      // ✅ ПРОВЕРКА: нет ли более длинного слова внутри этого?
      let skipWord = false;
      for (const [longerWord] of Object.entries(MAT_SCORE)) {
        if (longerWord.length > badWord.length && 
            longerWord.includes(badWord) && 
            lower.includes(longerWord)) {
          skipWord = true;
          break;
        }
      }
      
      // ✅ Если НЕТ более длинного - засчитываем!
      if (!skipWord) {
        rawScore += points;
        foundWords.push(`${badWord}×1`);
        matCount++;
      }
    }
  }

  let bonusScore = 0;
  if (rawScore > 0) {
    bonusScore = (text.match(/[А-ЯЪЫЬЭЁ]{3,}/g) || []).length * 10 + 
                 (text.match(/[!]{2,}/g) || []).length * 8;
  }

  const finalScore = Math.min(rawScore + bonusScore, 100);
  console.log(`🔍 "${text}" → ${finalScore}% (${foundWords.join(', ') || 'clean'})`);

  const risk = finalScore > 80 ? "🔥 HIGH" : 
               finalScore > 50 ? "🚨 MEDIUM" : 
               finalScore > 25 ? "⚠️ LOW" : "✅ OK";
  
  return { score: finalScore, risk, words: foundWords, matCount };
}

export async function POST(request: NextRequest) {
  console.log("📨 POST /api/webhook");

  try {
    const body = await request.json();
    const chatId = Number(body.message?.chat?.id);
    const user = body.message?.from?.username || body.message?.from?.first_name || "unknown";
    const text = body.message?.text || "";

    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`👤 ${user} [${chatId}]: "${text}"`);

    if (text) {
      const { score, risk, words, matCount } = analyzeConflict(text, chatId);
      
      try {
        addStat(words.join(', ') || text.slice(0, 30), score);
      } catch (e: unknown) {
        console.log('⚠️ addStat:', (e as Error).message);
      }

      if (score > 25 && words.length > 0) {
        console.log(`⚡ АЛАРМ ${risk}! ${score}% (${words.join(', ')})`);
        
        const ADMIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
        const token = process.env.TELEGRAM_TOKEN;
        
        if (!ADMIN_CHAT_ID || !token) {
          console.error("❌ ENV не найден:", { ADMIN_CHAT_ID, hasToken: !!token });
          return NextResponse.json({ ok: true });
        }
        
        const emoji = score > 80 ? "🔥" : score > 50 ? "🚨" : "⚠️";
        
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: `${emoji} CONFLICTGUARD | ${risk}\n👤 ${user}\n💬 "${text}"\n⚡ ${Math.round(score)}% | ${words.join(', ')}`
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
