/**
 * Simple conflict/politeness analyzer: riskScore 0–100 and riskLevel LOW | MEDIUM | HIGH.
 */

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AnalysisResult {
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

// Explicit toxic / abusive lexicon
const TOXIC_WORDS: string[] = [
  "дурак",
  "идиот",
  "тупой",
  "дебил",
  "урод",
  "мудак",
  "блять",
  "пиздец",
  "хуй",
  "пидор",
  "сука",
  "хватит",
  "прекратите",
  "безобразие",
];

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

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function countMatches(text: string, words: string[]): number {
  const normalized = normalizeText(text);
  let count = 0;

  for (const w of words) {
    const term = w.toLowerCase().trim();
    if (!term) continue;

    // Простой contains для русских/английских слов и фраз
    if (normalized.includes(term)) {
      count += 1;
    }
  }

  return count;
}

function extractMatchedTerms(text: string, words: string[]): string[] {
  const normalized = normalizeText(text);
  const tokens = normalized.match(/\p{L}+/gu) ?? [];
  const tokenSet = new Set(tokens);

  const uniqueTerms = Array.from(new Set(words.map((w) => w.toLowerCase().trim()).filter(Boolean)));
  const result = new Set<string>();

  for (const term of uniqueTerms) {
    // Multi-word phrases: substring match
    if (term.includes(" ")) {
      if (normalized.includes(term)) {
        result.add(term);
      }
      continue;
    }

    if (tokenSet.has(term)) {
      result.add(term);
    }
  }

  return Array.from(result);
}

/**
 * Analyzes message text and returns riskScore (0–100), riskLevel, and reasons.
 */
export function analyzeMessage(text: string): AnalysisResult {
  if (!text?.trim()) {
    return { riskScore: 0, riskLevel: "LOW", reasons: ["Empty message"] };
  }

  const reasons: string[] = [];
  const triggerCount = countMatches(text, CONFLICT_TRIGGERS);
  const softenerCount = countMatches(text, SOFTENERS);

  const negativeTerms = extractMatchedTerms(text, CONFLICT_TRIGGERS);
  const softeningTerms = extractMatchedTerms(text, SOFTENERS);

  // Base score from triggers (one trigger ≈ MEDIUM, two+ ≈ HIGH)
  let score = Math.min(triggerCount * 40, 95);
  if (triggerCount > 0) reasons.push(`Conflict triggers: ${triggerCount}`);

  // Softeners reduce score
  score -= softenerCount * 12;
  if (softenerCount > 0) reasons.push(`Softening phrases: ${softenerCount}`);

  if (negativeTerms.length > 0) {
    reasons.push(`Негативная лексика: ${negativeTerms.join(", ")}`);
  }
  if (softeningTerms.length > 0) {
    reasons.push(`Смягчающие слова: ${softeningTerms.join(", ")}`);
  }

  // Length factor: very short aggressive messages can be sharper
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount <= 3 && triggerCount > 0) score += 10;
  if (wordCount > 20 && softenerCount > 0) score -= 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLevel: RiskLevel = "LOW";
  if (score >= HIGH_THRESHOLD) riskLevel = "HIGH";
  else if (score >= MEDIUM_THRESHOLD) riskLevel = "MEDIUM";

  return {
    riskScore: score,
    riskLevel,
    reasons: reasons.length > 0 ? reasons : ["Neutral tone"],
  };
}
