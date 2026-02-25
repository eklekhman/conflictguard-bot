/**
 * In-memory store for conflict alerts (for dashboard and logging).
 */

import type { RiskLevel } from "./conflictAnalyzer";

export interface StoredAlert {
  id: string;
  timestamp: string; // ISO
  chatId: number;
  chatTitle?: string;
  authorId: number;
  authorUsername?: string;
  authorFirstName?: string;
  messageText: string;
  riskScore: number;
  riskLevel: RiskLevel;
  reasons: string[];
}

const MAX_ALERTS = 200;
const alerts: StoredAlert[] = [];
let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `alert-${Date.now()}-${idCounter}`;
}

export function addAlert(alert: Omit<StoredAlert, "id" | "timestamp">): StoredAlert {
  const stored: StoredAlert = {
    ...alert,
    id: nextId(),
    timestamp: new Date().toISOString(),
  };
  alerts.unshift(stored);
  if (alerts.length > MAX_ALERTS) alerts.pop();
  return stored;
}

export function getAlerts(options?: {
  riskLevel?: RiskLevel;
  limit?: number;
}): StoredAlert[] {
  let list = [...alerts];
  if (options?.riskLevel) {
    list = list.filter((a) => a.riskLevel === options.riskLevel);
  }
  const limit = options?.limit ?? 50;
  return list.slice(0, limit);
}
