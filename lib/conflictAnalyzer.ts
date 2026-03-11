export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AnalysisResult {
  /**
   * Итоговый балл токсичности 0–100.
   */
  score: number;
  /**
   * Уровень риска конфликта по порогам:
   * - LOW  (0–30)
   * - MEDIUM (31–70)
   * - HIGH (71–100)
   */
  risk: RiskLevel;
  /**
   * Объяснения, какие слова дали вклад в итоговый балл.
   * Например: ['дурак (+25)', 'idiot (+25)'].
   */
  reasons: string[];
}

// UTF‑8 байты → строка (фикс стабильности кириллицы на Vercel)
const utf8 = (bytes: number[]) =>
  new TextDecoder("utf-8").decode(new Uint8Array(bytes));

/**
 * Базовые русские слова, собранные из UTF‑8 байтов.
 * Не зависят от кодировки исходника.
 */
const RU_WORDS = {
  // "дурак"
  durak: utf8([0xd0, 0xb4, 0xd1, 0x83, 0xd1, 0x80, 0xd0, 0xb0, 0xd0, 0xba]),
  // "идиот"
  idiot: utf8([0xd0, 0xb8, 0xd0, 0xb4, 0xd0, 0xb8, 0xd0, 0xbe, 0xd1, 0x82]),
  // "тупой"
  tupoy: utf8([0xd1, 0x82, 0xd1, 0x83, 0xd0, 0xbf, 0xd0, 0xbe, 0xd0, 0xb9]),
  // "дебил"
  debil: utf8([0xd0, 0xb4, 0xd0, 0xb5, 0xd0, 0xb1, 0xd0, 0xb8, 0xd0, 0xbb]),
  // "мудак"
  mudak: utf8([0xd0, 0xbc, 0xd1, 0x83, 0xd0, 0xb4, 0xd0, 0xb0, 0xd0, 0xba]),
  // "сука"
  suka: utf8([0xd1, 0x81, 0xd1, 0x83, 0xd0, 0xba, 0xd0, 0xb0]),
};

/**
 * Словарь весов триггеров (слово → балл).
 * Русские ключи задаём через RU_WORDS, английские — обычными строками.
 */
const TRIGGERS: Record<string, number> = {
  // Русские (через байты)
  [RU_WORDS.durak]: 25, // дурак
  [RU_WORDS.idiot]: 30, // идиот
  [RU_WORDS.tupoy]: 20, // тупой
  [RU_WORDS.debil]: 40, // дебил
  // Эти слова объявляем напрямую строками — их кодировка и так стабильна
  кретин: 45,
  [RU_WORDS.mudak]: 60, // мудак
  [RU_WORDS.suka]: 70, // сука
  пошел: 10,
  нахуй: 85,
  хуй: 85,
  пиздец: 90,

  // Английские
  idiot: 25,
  stupid: 20,
  fuck: 80,
};

const PUNCTUATION_REGEX = /[.,!?;:()"'\-]+/g;

function normalize(message: string): string[] {
  let text = message || "";
  text = text.toLocaleLowerCase("ru-RU");
  text = text.replace(PUNCTUATION_REGEX, " ");
  return text.split(/\s+/).filter(Boolean);
}

export function analyze(message: string): AnalysisResult {
  const trimmed = message?.trim() ?? "";
  if (!trimmed) {
    return {
      score: 0,
      risk: "LOW",
      reasons: ["Empty message"],
    };
  }

  const tokens = normalize(trimmed);
  let score = 0;
  const counts: Record<string, number> = {};

  for (const token of tokens) {
    const weight = TRIGGERS[token];
    if (!weight) continue;
    counts[token] = (counts[token] ?? 0) + 1;
    score += weight;
  }

  // Ограничиваем итоговый балл 0–100
  score = Math.max(0, Math.min(100, score));

  let risk: RiskLevel = "LOW";
  if (score > 70) risk = "HIGH";
  else if (score > 30) risk = "MEDIUM";

  const reasons: string[] = [];
  for (const [word, count] of Object.entries(counts)) {
    const weight = TRIGGERS[word]!;
    const total = weight * count;
    reasons.push(`${word} (+${total})`);
  }

  if (reasons.length === 0) {
    reasons.push("No toxic triggers detected");
  }

  return { score, risk, reasons };
}

/**
 * Обратная совместимость со старым именем функции.
 * Новым кодом рекомендуется пользоваться analyze().
 */
export function analyzeMessage(text: string): AnalysisResult {
  return analyze(text);
}
