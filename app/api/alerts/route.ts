/**
 * GET /api/alerts — returns stored alerts for the dashboard (optional filter by riskLevel).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAlerts } from "@/lib/alertsStore";
import type { RiskLevel } from "@/lib/conflictAnalyzer";

const VALID_LEVELS: RiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const riskLevel = searchParams.get("riskLevel") as RiskLevel | null;
  const limitParam = searchParams.get("limit");

  const level = riskLevel && VALID_LEVELS.includes(riskLevel) ? riskLevel : undefined;
  const limit = limitParam
    ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50))
    : 50;
  const alerts = getAlerts({ riskLevel: level, limit });

  return NextResponse.json({ alerts });
}
