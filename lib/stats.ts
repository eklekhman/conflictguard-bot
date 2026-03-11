
// lib/stats.ts — in-memory статистика для live Dashboard (dev без БД)
export interface Stat {
  word: string;
  count: number;
  severity: "LOW" | "MEDIUM" | "HIGH";
  createdAt: string;
}

const stats: Stat[] = [];

export function addStat(word: string, score: number): void {
  const severity: Stat["severity"] =
    score > 80 ? "HIGH" : score > 50 ? "MEDIUM" : "LOW"; // ← 50, НЕ 40!

  const existing = stats.find((s) => s.word === word);
  if (existing) {
    existing.count++;
    existing.severity = severity; // ← КРИТИЧНО! Обновляем риск
    existing.createdAt = new Date().toISOString(); // ← Свежая дата
  } else {
    stats.push({
      word,
      count: 1,
      severity,
      createdAt: new Date().toISOString(),
    });
  }
  
  if (stats.length > 50) stats.shift(); // Ограничиваем размер
  console.log(`📊 "${word}" → ${existing ? existing.count + 1 : 1} (${severity})`);
}

export function getStats(): Stat[] {
  return [...stats].sort((a, b) => b.count - a.count); // По популярности
}
