import { NextRequest, NextResponse } from "next/server";
import { addStat } from "@/lib/stats";

declare global {
  var chatHistory: Map<number, { text: string; time: number }[]>;
}

if (!global.chatHistory) {
  global.chatHistory = new Map();
}

const BAD_WORDS: { [key: string]: number } = {
  "хуй": 85, "блять": 70, "блядь": 70, "пиздец": 80, "сука": 65,
  "пизда": 75, "нахуй": 95, "мудак": 60, "заебал": 75, "ебать": 80,
  "пидор": 85, "пидорас": 90, "еблан": 70, "пиздюк": 65,
  "дурак": 25, "дура": 20, "тупой": 30, "тупая": 30, "дебил": 40,
  "идиот": 50, "кретин": 45, "урод": 40, "козел": 35, "тварь": 55,
  "мразь": 60, "сволочь": 50, "чмо": 50, "придурок": 40,
  "убью": 90, "зарежу": 95, "задушу": 85, "изобью": 80, "закопаю": 95,
  "драка": 35, "война": 40, "бойня": 50, "скандал": 30, "разборка": 35
};

function tokenize(text: string): string[] {
  const lowered = text.toLowerCase();
  const words: string[] = [];
  let currentWord = "";
  
  for (let i = 0; i < lowered.length; i++) {
    const char = lowered[i];
    const code = char.charCodeAt(0);
    
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
  score: number; wordScore: number; risk: string; words: string[]; matCount: number;
} {
  const tokens = tokenize(text);
  let wordScore = 0;
  let bonus = 0;
  const found: { word: string; points: number; count: number }[] = [];

  for (const token of tokens) {
    if (BAD_WORDS[token]) {
      const points = BAD_WORDS[token];
      wordScore += points;
      
      const existing = found.find(f => f.word === token);
      if (existing) {
        existing.count++;
      } else {
        found.push({ word: token, points, count: 1 });
      }
    }
  }

  const upperCount = (text.match(/[А-ЯЁ]{2,}/g) || []).length;
  const punctCount = (text.match(/[!?.]{2,}/g) || []).length;
  bonus = upperCount * 12 + punctCount * 10;

  const total = Math.min(wordScore + bonus, 100);
  const risk = total > 80 ? "HIGH" : total > 50 ? "MEDIUM" : 
               total > 15 ? "LOW" : "OK";

  const wordsList = found.map(f => `${f.word} ×${f.count} (${f.points})`);

  console.log(`🎯 [${chatId}] "${text}" → ${wordScore+b_bonus}/${total}%`);

  return { score: total, wordScore, risk, words: wordsList, matCount: found.length };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const msg = body.message;
    const chatId = Number(msg?.chat?.id);
    const user = msg?.from?.username || msg?.from?.first_name || "аноним";
    const text = msg?.text || "";

    if (!global.chatHistory.has(chatId)) global.chatHistory.set(chatId, []);
    const history = global.chatHistory.get(chatId)!;
    history.push({ text, time: Date.now() });
    if (history.length > 20) history.shift();

    console.log(`[${chatId}] ${user}: "${text}"`);

    if (!text) return NextResponse.json({ ok: true });

    const analysis = analyzeConflict(text, chatId);
    
    try { addStat(text.slice(0, 50), analysis.score); } 
    catch (e) { console.log("📊 статистика не сохранилась"); }

    const token = process.env.TELEGRAM_TOKEN;
    if (!token) return NextResponse.json({ ok: true });

    if (analysis.score > 15 && analysis.words.length > 0) {
      const MAIN_CHAT_ID = Number(process.env.TELEGRAM_CHAT_ID || "0");
      const riskEmoji = analysis.score > 80 ? "🔥" : analysis.score > 50 ? "🚨" : "⚠️";

      if (MAIN_CHAT_ID) {
        const alert = `🔍 **CONFLICTGUARD ${analysis.risk}**
👤 **${user}**
💬 _${text}_
⚡ **${analysis.wordScore} / ${Math.round(analysis.score)}%**
📊 ${analysis.words.join(", ")}
💥 **#${riskEmoji}${analysis.risk}**`;

        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: MAIN_CHAT_ID,
            text: alert,
            parse_mode: "Markdown",
            disable_web_page_preview: true
          })
        }).catch(e => console.error("❌ мониторинг:", e));
      }

      if (analysis.score >= 75) {
        const adminIds = (process.env.ADMIN_CHAT_IDS || "")
          .split(",").map(id => id.trim()).map(Number).filter(id => !isNaN(id));

        const adminAlert = `🚨 **АЛАРМ CONFLICTGUARD**
🔗 **Чат:** \`${chatId}\`
👤 **${user}**
💬 _"${text}"_
⚡ **${analysis.wordScore} / ${Math.round(analysis.score)}%**
📊 ${analysis.words.join(", ")}
💥 **#🔥HIGH**`;

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
          }).catch(e => console.error(`❌ админ ${adminId}:`, e));
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("💥 ОШИБКА:", error);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
