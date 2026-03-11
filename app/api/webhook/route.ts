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
  сука: 65, пизда: 75,
  пиздец: 80, блять: 70, хуй: 85,
  нахуй: 95,
  конфликт: 30, война: 40, драка: 50,
  убью: 90, зарежу: 95, заебал: 75,
  урод: 45, мразь: 60, тварь: 55
};

function analyzeConflict(text: string, chatId: number): { 
  score: number; 
  rawScore: number;
  risk: string; 
  words: string[]; 
  matCount: number 
} {
  const lower = text.toLowerCase();
  let rawScore = 0;
  const foundWords: string[] = [];
  let matCount = 0;

  // 🔥 ПРОСТОЙ .includes() БЕЗ regex - ЛОВИМ ВСЕ!
  for (const [badWord, points] of Object.entries(MAT_SCORE)) {
    if (lower.includes(badWord)) {
      // ✅ Лёгкая защита: пропускаем только если ТОЧНО короче И внутри другого
      const isSubstring = Object.entries(MAT_SCORE).some(([longerWord, longerPoints]) => 
        longerWord.length > badWord.length + 1 && // Минимум на 2 буквы длиннее
        longerWord.includes(badWord) && 
        lower.includes(longerWord)
      );
      
      if (!isSubstring) {
        rawScore += points;
        if (!foundWords.some(w => w.includes(badWord))) {
          foundWords.push(`${badWord}×1 (${points} баллов)`);
        }
        matCount++;
      }
    }
  }

  // Бонусы БЕЗ regex
  let bonusScore = 0;
  if (rawScore > 0) {
    const upperCount = (text.match(/[А-ЯЪЫЬЭЁ]{3,}/g) || []).length;
    const punctCount = (text.match(/[!]{2,}/g) || []).length;
    bonusScore = upperCount * 10 + punctCount * 8;
  }

  const finalScore = Math.min(rawScore + bonusScore, 100);
  console.log(`🔍 "${text}" → ${finalScore}% (${Math.round(rawScore)}/${Math.round(finalScore)}%) (${foundWords.join(', ') || 'clean'})`);

  const risk = finalScore > 80 ? "🔥 HIGH" : 
               finalScore > 50 ? "🚨 MEDIUM" : 
               finalScore > 25 ? "⚠️ LOW" : "✅ OK";
  
  return { score: finalScore, rawScore: rawScore + bonusScore, risk, words: foundWords, matCount };
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
      const { score, rawScore, risk, words } = analyzeConflict(text, chatId);
      
      try {
        addStat(words.join(', ') || text.slice(0, 30), score);
      } catch (e) {
        console.log('⚠️ addStat:', e);
      }

      const token = process.env.TELEGRAM_TOKEN;
      if (!token) {
        console.error("❌ TELEGRAM_TOKEN не найден!");
        return NextResponse.json({ ok: true });
      }

      // 🔥 ОСНОВНОЕ УВЕДОМЛЕНИЕ (>25%)
      if (score > 25 && words.length > 0) {
        console.log(`⚡ АЛАРМ ${risk}! ${score}% (${Math.round(rawScore)}/${Math.round(score)}%)`);
        
        const MAIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
        const emoji = score > 80 ? "🔥" : score > 50 ? "🚨" : "⚠️";
        
        // 1️⃣ ГЛАВНЫЙ ЧАТ
        if (MAIN_CHAT_ID) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: MAIN_CHAT_ID,
              text: `${emoji} CONFLICTGUARD | ${risk}\n👤 ${user}\n💬 "${text}"\n⚡ ${Math.round(rawScore)}/${Math.round(score)}% | ${words.join(', ')}`
            })
          }).catch(err => console.error('❌ Главный чат:', err));
        }

        // 2️⃣ АДМИНЫ (>=75%)
        if (score >= 75) {
          const adminChatIds = (process.env.ADMIN_CHAT_IDS || "")
            .split(',')
            .map(id => Number(id.trim()))
            .filter(id => id && !isNaN(id));
          
          console.log(`🔔 Админам (${adminChatIds.length}): ${adminChatIds.join(', ')}`);
          
          for (const adminId of adminChatIds) {
            await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: adminId,
                text: `🚨 [${chatId}] ${risk} АЛАРМ!\n👤 ${user}\n💬 "${text}"\n⚡ ${Math.round(rawScore)}/${Math.round(score)}% | ${words.join(', ')}`
              })
            }).catch(err => console.error(`❌ Админ ${adminId}:`, err));
          }
        }
      } else {
        console.log(`✅ OK: ${score}% "${text}" (чистый)`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("❌ ERROR:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
