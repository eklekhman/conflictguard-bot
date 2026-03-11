import { NextRequest, NextResponse } from "next/server";
import { addStat } from "@/lib/stats";

declare global {
  var chatHistory: Map<number, { text: string; time: number }[]>;
}

if (!global.chatHistory) {
  global.chatHistory = new Map();
}

const BAD_WORDS: { [key: string]: number } = {
  // 🔥 МАТ (65-95 баллов)
  "хуй": 85, "блять": 70, "блядь": 70, "пиздец": 80, "сука": 65,
  "пизда": 75, "нахуй": 95, "мудак": 60, "заебал": 75, "ебать": 80,
  "пидор": 85, "пидорас": 90, "еблан": 70, "пиздюк": 65,
  
  // ⚠️ ОСКОРБЛЕНИЯ (15-60 баллов)
  "дурак": 25, "дура": 20, "дурачина": 25, "тупой": 30, "тупая": 30,
  "дебил": 40, "дебильный": 35, "идиот": 50, "идиотка": 45, "кретин": 45,
  "урод": 40, "уродина": 45, "козел": 35, "коза": 30, "тварь": 55,
  "мразь": 60, "сволочь": 50, "чмо": 50, "придурок": 40, "придурь": 35,
  
  // ☠️ УГРОЗЫ (70-95 баллов)
  "убью": 90, "зарежу": 95, "задушу": 85, "изобью": 80, "закопаю": 95,
  "разъебу": 90, "похерю": 75, "уничтожу": 80,
  
  // ⚔️ КОНФЛИКТЫ (25-50 баллов)
  "драка": 35, "война": 40, "бойня": 50, "скандал": 30, "разборка": 35
};

function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const words: string[] = [];
  let currentWord = "";
  
  for (let i = 0; i < lowered.length; i++) {
    const char = lowered[i];
    const code = char.charCodeAt(0);
    
    // русские буквы + ё + цифры + дефис
    if ((code >= 1072 && code <= 1103) || char === "ё" || 
        (code >= 48 && code <= 57) || char === "-") {
      currentWord += char;
    } else if (currentWord.length > 1) {
      words.push(currentWord);
      currentWord = "";
    }
  }
  if (currentWord.length > 1) words.push(currentWord);
  
  return words;
}

function analyzeConflict(text: string, chatId: number): {
  score: number; rawScore: number; risk: string; words: string[]; matCount: number;
} {
  const tokens = tokenize(text);
  let rawScore = 0;
  const found: { word: string; points: number; count: number }[] = [];

  // точное совпадение слов
  for (const token of tokens) {
    if (BAD_WORDS[token]) {
      const points = BAD_WORDS[token];
      rawScore += points;
      
      const existing = found.find(f => f.word === token);
      if (existing) {
        existing.count++;
      } else {
        found.push({ word: token, points, count: 1 });
      }
    }
  }

  const matCount = found.reduce((sum, f) => sum + f.count, 0);
  
  // бонус за агрессию (КАПС + знаки)
  let bonus = 0;
  const upperCount = (text.match(/[А-ЯЁ]{2,}/g) || []).length;
  const punctCount = (text.match(/[!?.]{2,}/g) || []).length;
  const spamCount = tokens.length > 5 ? 10 : 0;
  bonus = upperCount * 12 + punctCount * 10 + spamCount;

  const total = Math.min(rawScore + bonus, 100);
  const risk = total > 80 ? "🔥 HIGH" : total > 50 ? "🚨 MEDIUM" : 
               total > 15 ? "⚠️ LOW" : "✅ OK";

  const wordsList = found.map(f => `${f.word}x${f.count}(${f.points})`);

  console.log(`🎯 [${chatId}] "${text}" → ${total}% | ${wordsList.join(", ") || "чистый"}`);

  return { score: total, rawScore: rawScore + bonus, risk, words: wordsList, matCount };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const msg = body.message;
    const chatId = Number(msg?.chat?.id);
    const user = msg?.from?.username || msg?.from?.first_name || "аноним";
    const text = msg?.text || "";

    // сохраняем историю (20 сообщений)
    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`[${chatId}] ${user}: "${text}"`);

    if (!text) return NextResponse.json({ ok: true });

    const analysis = analyzeConflict(text, chatId);
    
    // статистика
    try { addStat(text.slice(0, 50), analysis.score); } 
    catch (e) { console.log("📊 статистика не сохранилась"); }

    const token = process.env.TELEGRAM_TOKEN;
    if (!token) return NextResponse.json({ ok: true });

    // 🎨 УВЕДОМЛЕНИЯ >15% в мониторинг
    if (analysis.score > 15 && analysis.words.length > 0) {
      const MAIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
      const riskEmoji = analysis.score > 80 ? "🔥" : analysis.score > 50 ? "🚨" : "⚠️";

      // мониторинг
      if (MAIN_CHAT_ID) {
        const alert = `╭─🔍 **CONFLICTGUARD ${analysis.risk}**
│ 👤 **${user}**
│ 💬 _${text}_
│ ⚡ **${Math.round(analysis.rawScore)}%**
│ 📊 ${analysis.words.join(", ")}
╰─💥 **#${riskEmoji}**`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: MAIN_CHAT_ID,
            text: alert,
            parse_mode: "Markdown",
            disable_web_page_preview: true
          })
        }).catch(e => console.error("❌ мониторинг ошибка:", e));
      }

      // 🚨 АДМИНАМ >75%
      if (analysis.score >= 75) {
        const adminIds = (process.env.ADMIN_CHAT_IDS || "")
          .split(",").map(id => id.trim()).map(Number).filter(id => !isNaN(id));

        const adminAlert = `🚨 **АЛАРМ CONFLICTGUARD**
🔗 **Чат:** \`${chatId}\`
👤 **${user}**
💬 _"${text}"_
⚡ **${Math.round(analysis.rawScore)}%**
📊 ${analysis.words.join(", ")}
💥 **#HIGH**`;

        for (const adminId of adminIds) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: adminId,
              text: adminAlert,
              parse_mode: "Markdown",
              disable_web_page_preview: true
            })
          }).catch(e => console.error(`❌ админ ${adminId} ошибка:`, e));
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("💥 КРИТИЧЕСКАЯ ОШИБКА:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
