/**
 * Simple conflict/politeness analyzer: riskScore 0–100 and riskLevel LOW | MEDIUM | HIGH.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

// Слова из UTF-8 байтов — не зависят от кодировки исходника/бандла (фикс Vercel)
const utf8 = (arr: number[]) => new TextDecoder("utf-8").decode(new Uint8Array(arr));
const FALLBACK_RU_BYTES: [number[], number][] = [
  [ [0xd0, 0xb4, 0xd1, 0x83, 0xd1, 0x80, 0xd0, 0xb0, 0xd0, 0xba], 25 ],   // дурак
  [ [0xd0, 0xb8, 0xd0, 0xb4, 0xd0, 0xb8, 0xd0, 0xbe, 0xd1, 0x82], 30 ],   // идиот
  [ [0xd1, 0x82, 0xd1, 0x83, 0xd0, 0xbf, 0xd0, 0xbe, 0xd0, 0xb9], 20 ],   // тупой
  [ [0xd0, 0xb4, 0xd0, 0xb5, 0xd0, 0xb1, 0xd0, 0xb8, 0xd0, 0xbb], 40 ],   // дебил
  [ [0xd0, 0xbc, 0xd1, 0x83, 0xd0, 0xb4, 0xd0, 0xb0, 0xd0, 0xba], 60 ],   // мудак
  [ [0xd1, 0x81, 0xd1, 0x83, 0xd0, 0xba, 0xd0, 0xb0], 70 ],               // сука
];
const FALLBACK_RU: Record<string, number> = Object.fromEntries(
  FALLBACK_RU_BYTES.map(([bytes, points]) => [utf8(bytes), points])
);

const RUSSIAN_TRIGGERS: Record<string, number> = {
  дурак: 25,
  идиот: 30,
  тупой: 20,
  дебил: 40,
  кретин: 45,
  мудак: 60,
  сука: 70,
  хуй: 85,
  пошел: 50,
  нахуй: 50,
  пидор: 55,
  блять: 35,
  пиздец: 40,
  урод: 30,
  мразь: 50,
  ублюдок: 55,
  говно: 45,
  хватит: 20,
  прекратите: 20,
  безобразие: 25,
};

const NEGATIVE_WORDS_RU = Object.keys(RUSSIAN_TRIGGERS);

const TOXIC_WORDS: string[] = [...NEGATIVE_WORDS_RU];

// Words and phrases that increase conflict risk (Russian + English examples)
const BASE_CONFLICT_TRIGGERS: string[] = [
  "идиот",
  "дурак",
  "тупой",
  "бестолковый",
  "отстой",
  "ужас",
  "кошмар",
  "безобразие",
  "невозможно",
  "никогда",
  "никогда так не делайте",
  "вы обязаны",
  "вы должны",
  "категорически",
  "требую",
  "прекратите",
  "хватит",
  "надоело",
  "достало",
  "идиот",
  "idiot",
  "stupid",
  "terrible",
  "awful",
  "unacceptable",
  "ridiculous",
  "you must",
  "you have to",
  "stop it",
  "enough",
  "worst",
  "useless",
  "какая глупость",
  "это глупо",
  "полный провал",
  "полный отстой",
];

const CONFLICT_TRIGGERS: string[] = Array.from(
  new Set([...BASE_CONFLICT_TRIGGERS, ...TOXIC_WORDS])
);

// Softening words that decrease risk
const SOFTENERS: string[] = [
  "пожалуйста",
  "спасибо",
  "благодарю",
  "извините",
  "простите",
  "к сожалению",
  "к счастью",
  "по возможности",
  "если можно",
  "please",
  "thank you",
  "thanks",
  "sorry",
  "unfortunately",
  "if possible",
  "would you mind",
  "could you",
  "kindly",
];

const HIGH_THRESHOLD = 55;
const MEDIUM_THRESHOLD = 25;

/** Без ICU: только toLowerCase() + trim для любой среды (Vercel/Node). */
function normalizeText(text: string): string {
  if (typeof text !== "string") return "";
  return text.toLowerCase().trim();
}

function countMatches(text: string, words: string[]): number {
  const lower = normalizeText(text);
  let count = 0;
  for (const w of words) {
    const term = w.toLowerCase().trim();
    if (!term) continue;
    if (lower.includes(term)) count += 1;
  }
  return count;
}

function extractMatchedTerms(text: string, words: string[]): string[] {
  const lower = normalizeText(text);
  const result = new Set<string>();
  for (const w of words) {
    const term = w.toLowerCase().trim();
    if (!term) continue;
    if (lower.includes(term)) result.add(term);
  }
  return Array.from(result);
}

/** Байтовый поиск русских слов БЕЗ ICU. Сначала FALLBACK_RU (из байтов), потом RUSSIAN_TRIGGERS. */
function scoreRussianTriggers(text: string): { score: number; hits: string[] } {
  const lower = text.toLowerCase();
  let score = 0;
  const hits: string[] = [];
  const add = (word: string, points: number) => {
    if (lower.includes(word)) {
      score += points;
      hits.push(word);
      if (process.env.CONFLICTGUARD_DEBUG === "1") {
        console.log(`[ConflictGuard] HIT: "${word}" = +${points}`);
      }
    }
  };
  for (const word of Object.keys(FALLBACK_RU)) add(word, FALLBACK_RU[word]);
  for (const word of Object.keys(RUSSIAN_TRIGGERS)) {
    if (!hits.includes(word)) add(word, RUSSIAN_TRIGGERS[word]);
  }
  return { score, hits };
}

/**
 * Analyzes message text and returns riskScore (0–100), riskLevel, and reasons.
 * 100% без ICU: только toLowerCase() + includes().
 */
export function analyzeMessage(text: string): AnalysisResult {
  if (!text?.trim()) {
    return { riskScore: 0, riskLevel: "LOW", reasons: ["Empty message"] };
  }

  if (process.env.CONFLICTGUARD_DEBUG === "1") {
    console.log("[ConflictGuard] RAW:", JSON.stringify(text));
    console.log("[ConflictGuard] LENGTH:", text.length);
  }

  const reasons: string[] = [];
  const { score: russianScore, hits: russianHits } = scoreRussianTriggers(text);
  const otherTriggers = CONFLICT_TRIGGERS.filter((w) => !(w in RUSSIAN_TRIGGERS));
  const otherCount = countMatches(text, otherTriggers);
  const softenerCount = countMatches(text, SOFTENERS);
  const softeningTerms = extractMatchedTerms(text, SOFTENERS);

  let score = russianScore + otherCount * 20;
  score = Math.min(score, 95);
  const triggerCount = russianHits.length + otherCount;
  if (triggerCount > 0) reasons.push(`Conflict triggers: ${triggerCount}`);

  // Softeners reduce score
  score -= softenerCount * 12;
  if (softenerCount > 0) reasons.push(`Softening phrases: ${softenerCount}`);

  const otherHits = extractMatchedTerms(text, otherTriggers);
  const negativeTerms = [...russianHits, ...otherHits];
  if (negativeTerms.length > 0) {
    reasons.push(`Негативная лексика: ${negativeTerms.join(", ")}`);
  }
  if (softeningTerms.length > 0) {
    reasons.push(`Смягчающие слова: ${softeningTerms.join(", ")}`);
  }

  // Length factor
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount <= 3 && triggerCount > 0) score += 10;
  if (wordCount > 20 && softenerCount > 0) score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLevel: RiskLevel = "LOW";
  if (score >= HIGH_THRESHOLD) riskLevel = "HIGH";
  else if (score >= MEDIUM_THRESHOLD) riskLevel = "MEDIUM";

  if (process.env.CONFLICTGUARD_DEBUG === "1") {
    console.log("[ConflictGuard] FINAL SCORE:", score, "riskLevel:", riskLevel);
  }

  return {
    riskScore: score,
    riskLevel,
    reasons: reasons.length > 0 ? reasons : ["Neutral tone"],
  };
}
