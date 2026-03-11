import { NextRequest, NextResponse } from "next/server";
import { addStat } from "@/lib/stats";

declare global {
  var chatHistory: Map<number, { text: string; time: number }[]>;
}

if (!global.chatHistory) {
  global.chatHistory = new Map();
}

const MAT_SCORE: { [key: string]: number } = {
  // 🔥 МАТ (высокий риск)
  хуй: 85, блять: 70, пиздец: 80, сука: 65, мудак: 60,
  нахуй: 95, пизда: 75, ебать: 80, заебал: 75, наебал: 70,
  пидор: 90, гей: 85, лесби: 80, хуесос: 95,
  
  // ⚠️ ОСКОРБЛЕНИЯ (средний риск)  
  дебил: 40, дебильный: 40, дебилизм: 40, тупой: 35, тупая: 35,
  кретин: 45, кретинизм: 45, идиот: 50, идиотизм: 50, retardation: 55,
  дурак: 25, дурацкий: 25, дура: 30, дурой: 30, дурной: 30,
  мудаковатый: 60, урод: 45, уродина: 50, козел: 40, коза: 40,
  сволочь: 50, подонок: 55, мразь: 60, тварь: 55, скотина: 50,
  чмо: 65, чушь: 30, бред: 25, херня: 40, фигня: 20,
  
  // ☠️ УГРОЗЫ (критический риск)
  убью: 90, зарежу: 95, прикончу: 95, замучу: 85, задушу: 90, мразота: 65, гнида: 60, паскуда: 55, падла: 60,
  
  // ⚔️ КОНФЛИКТЫ
  конфликт: 30, война: 40, драка: 50, бойня: 60, разборка: 45,
  подставил: 50, кинул: 55, обманул: 45, предал: 60, сдал: 65
};

function analyzeConflict(text: string, chatId: number): { 
  score: number; 
  risk: string; 
  words: string[]; 
  matCount: number 
} {
  const lower = text.toLowerCase();
  let totalScore = 0;
  const foundWords: string[] = [];
  let matCount = 0;

  // 🔥 НАЙДИ ВСЕ слова + посчитай повторения!
  for (const [word, points] of Object.entries(MAT_SCORE)) {
    const count = (lower.match(new RegExp(word, 'gi')) || []).length;
    if (count > 0) {
      totalScore += points * count;
      foundWords.push(`${word}×${count}`);
      matCount += count;
    }
  }

  // 🎁 БОНУСЫ за капс и знаки
  let bonusScore = 0;
  if (totalScore > 0) {
    bonusScore = (text.match(/[А-ЯЪЫЬЭЁ]{3,}/g) || []).length * 10 + 
                 (text.match(/[!?.]{2,}/g) || []).length * 8 +
                 (text.match(/КТО|ЧТО|ГДЕ|КОГДА|ПОЧЕМУ|КАК|БЛЯ|ЁБ/g) || []).length * 5;
  }

  const finalScore = Math.min(totalScore + bonusScore, 100);
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

    // История чата (последние 20 сообщений)
    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`👤 ${user} [${chatId}]: "${text}"`);

    if (text) {
      const { score, risk, words, matCount } = analyzeConflict(text, chatId);
      
      // Статистика
      try {
        addStat(words.join(', ') || text.slice(0, 30), score);
      } catch (e: unknown) {
        console.log('⚠️ addStat:', (e as Error).message);
      }

      // 🚨 УВЕДОМЛЕНИЕ при риске!
      if (score > 25 && words.length > 0) {
        console.log(`⚡ АЛАРМ ${risk}! ${score}% (${words.join(', ')})`);
        
        const ADMIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
        const token = process.env.TELEGRAM_TOKEN;
        
        if (!ADMIN_CHAT_ID || !token) {
          console.error("❌ ENV сломан:", { ADMIN_CHAT_ID, hasToken: !!token });
          return NextResponse.json({ ok: true });
        }
        
        const emoji = score > 80 ? "🔥" : score > 50 ? "🚨" : "⚠️";
        const wordsList = words.slice(0, 3).join(', ') + (words.length > 3 ? '...' : '');
        
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: ADMIN_CHAT_ID,
            text: `${emoji} CONFLICTGUARD | ${risk}\n👤 ${user} [${chatId}]\n💬 "${text}"\n⚡ ${Math.round(score)}% | ${wordsList} (${matCount} слов)`
          })
        }).catch(err => console.error('❌ Уведомление:', err));
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