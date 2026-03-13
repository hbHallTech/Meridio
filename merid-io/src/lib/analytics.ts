import { prisma } from "@/lib/prisma";
import { LeaveStatus } from "@prisma/client";

// ─── Constants ───

const MOOD_VALUES: Record<string, number> = {
  VERY_BAD: 1,
  BAD: 2,
  NEUTRAL: 3,
  GOOD: 4,
  VERY_GOOD: 5,
};

const WORKING_DAYS_PER_YEAR = 220;

// ─── Risk Score (0-100) ───
//
// Formula:
//   20% Low seniority (< 1 year = 100, < 2 years = 60, < 3 years = 30, else 0)
//   25% Low recent mood (avg mood last 30d → inverted scale)
//   25% Objectives not achieved (% of non-achieved objectives)
//   15% Unused leave (high unused ratio → burnout signal)
//   10% No peer recognition (0 shoutouts received in 30d)
//    5% CDD contract ending soon (< 3 months)

export interface RiskScoreBreakdown {
  overall: number;
  seniority: number;
  mood: number;
  objectives: number;
  leaveUsage: number;
  recognition: number;
  contractRisk: number;
  label: "low" | "moderate" | "high" | "critical";
  details: {
    hireDate: string | null;
    seniorityMonths: number;
    moodAvg30d: number | null;
    moodCheckins30d: number;
    objectivesTotal: number;
    objectivesAchieved: number;
    leaveUsedRatio: number | null;
    shoutoutsReceived30d: number;
    cddEndDate: string | null;
  };
}

export async function computeUserRiskScore(userId: string): Promise<RiskScoreBreakdown | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      hireDate: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) return null;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const year = now.getFullYear();

  // Parallel queries
  const [moods, objectives, leaveBalances, shoutouts, contracts] = await Promise.all([
    // Mood check-ins last 30 days
    prisma.moodCheckin.findMany({
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      select: { mood: true },
    }),
    // All objectives (non-cancelled)
    prisma.objective.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      select: { status: true },
    }),
    // Current year leave balances
    prisma.leaveBalance.findMany({
      where: { userId, year, balanceType: "ANNUAL" },
      select: { totalDays: true, usedDays: true },
    }),
    // Shoutouts received last 30 days
    prisma.shoutout.count({
      where: { toUserId: userId, createdAt: { gte: thirtyDaysAgo } },
    }),
    // Active contracts
    prisma.contract.findMany({
      where: { userId, status: "ACTIF" },
      select: { type: true, endDate: true },
    }),
  ]);

  // 1. Seniority score (20%)
  const seniorityMonths = user.hireDate
    ? Math.floor((now.getTime() - user.hireDate.getTime()) / (30.44 * 24 * 60 * 60 * 1000))
    : 0;
  let seniorityRisk = 0;
  if (seniorityMonths < 12) seniorityRisk = 100;
  else if (seniorityMonths < 24) seniorityRisk = 60;
  else if (seniorityMonths < 36) seniorityRisk = 30;

  // 2. Mood score (25%)
  let moodRisk = 50; // default if no data
  let moodAvg: number | null = null;
  if (moods.length > 0) {
    moodAvg = moods.reduce((s, m) => s + MOOD_VALUES[m.mood], 0) / moods.length;
    // 5 → 0 risk, 1 → 100 risk (inverted linear)
    moodRisk = Math.round(((5 - moodAvg) / 4) * 100);
  }

  // 3. Objectives score (25%)
  let objectivesRisk = 0;
  const objTotal = objectives.length;
  const objAchieved = objectives.filter(
    (o) => o.status === "ACHIEVED" || o.status === "PARTIALLY_ACHIEVED"
  ).length;
  if (objTotal > 0) {
    objectivesRisk = Math.round(((objTotal - objAchieved) / objTotal) * 100);
  }

  // 4. Leave usage (15%)
  let leaveRisk = 0;
  let leaveUsedRatio: number | null = null;
  if (leaveBalances.length > 0) {
    const totalEntitled = leaveBalances.reduce((s, b) => s + b.totalDays, 0);
    const totalUsed = leaveBalances.reduce((s, b) => s + b.usedDays, 0);
    if (totalEntitled > 0) {
      leaveUsedRatio = totalUsed / totalEntitled;
      // Mid-year check: if we're past mid-year and used < 30% → risk
      const monthOfYear = now.getMonth();
      const expectedUsageRatio = monthOfYear / 12;
      if (leaveUsedRatio < expectedUsageRatio * 0.4) {
        leaveRisk = 80; // Very low usage relative to time passed
      } else if (leaveUsedRatio < expectedUsageRatio * 0.6) {
        leaveRisk = 50;
      }
    }
  }

  // 5. Recognition (10%)
  const recognitionRisk = shoutouts === 0 ? 80 : shoutouts < 2 ? 30 : 0;

  // 6. Contract risk (5%)
  let contractRisk = 0;
  let cddEndDate: string | null = null;
  const activeCdd = contracts.find(
    (c) => c.type === "CDD" || c.type === "SIVP" || c.type === "STAGE"
  );
  if (activeCdd?.endDate) {
    cddEndDate = activeCdd.endDate.toISOString();
    const monthsLeft = (activeCdd.endDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
    if (monthsLeft < 1) contractRisk = 100;
    else if (monthsLeft < 3) contractRisk = 70;
    else if (monthsLeft < 6) contractRisk = 30;
  }

  // Weighted total
  const overall = Math.round(
    seniorityRisk * 0.2 +
    moodRisk * 0.25 +
    objectivesRisk * 0.25 +
    leaveRisk * 0.15 +
    recognitionRisk * 0.1 +
    contractRisk * 0.05
  );

  const label: RiskScoreBreakdown["label"] =
    overall >= 70 ? "critical" : overall >= 50 ? "high" : overall >= 30 ? "moderate" : "low";

  return {
    overall,
    seniority: seniorityRisk,
    mood: moodRisk,
    objectives: objectivesRisk,
    leaveUsage: leaveRisk,
    recognition: recognitionRisk,
    contractRisk,
    label,
    details: {
      hireDate: user.hireDate?.toISOString() ?? null,
      seniorityMonths,
      moodAvg30d: moodAvg,
      moodCheckins30d: moods.length,
      objectivesTotal: objTotal,
      objectivesAchieved: objAchieved,
      leaveUsedRatio,
      shoutoutsReceived30d: shoutouts,
      cddEndDate,
    },
  };
}

// ─── Team / Company Analytics ───

export interface TeamAnalytics {
  teamId: string | null;
  teamName: string | null;
  headcount: number;
  turnoverRate: number;
  absenteeismRate: number;
  avgObjectiveCompletion: number;
  avgMood: number | null;
  avgRiskScore: number;
  riskAlerts: number; // count of users with risk >= 50
  moodTrend: Array<{ week: string; avg: number; count: number }>;
  objectivesByStatus: Record<string, number>;
  topRiskUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    riskScore: number;
    riskLabel: string;
  }>;
}

export async function computeTeamAnalytics(teamId: string): Promise<TeamAnalytics | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true },
  });
  if (!team) return null;

  return computeGroupAnalytics({ teamId }, team.id, team.name);
}

export async function computeCompanyAnalytics(): Promise<TeamAnalytics> {
  return computeGroupAnalytics({}, null, null);
}

async function computeGroupAnalytics(
  userFilter: Record<string, unknown>,
  teamId: string | null,
  teamName: string | null
): Promise<TeamAnalytics> {
  const now = new Date();
  const year = now.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Active users in scope
  const users = await prisma.user.findMany({
    where: { isActive: true, ...userFilter },
    select: { id: true, firstName: true, lastName: true, hireDate: true },
  });
  const headcount = users.length;
  const userIds = users.map((u) => u.id);

  if (headcount === 0) {
    return {
      teamId,
      teamName,
      headcount: 0,
      turnoverRate: 0,
      absenteeismRate: 0,
      avgObjectiveCompletion: 0,
      avgMood: null,
      avgRiskScore: 0,
      riskAlerts: 0,
      moodTrend: [],
      objectivesByStatus: {},
      topRiskUsers: [],
    };
  }

  // Departed users this year (turnover)
  const departed = await prisma.user.count({
    where: {
      ...userFilter,
      isActive: false,
      departureDate: { gte: startOfYear, lte: endOfYear },
    },
  });
  const turnoverRate = Math.round((departed / (headcount + departed)) * 100 * 10) / 10;

  // Absenteeism
  const approvedDays = await prisma.leaveRequest.aggregate({
    _sum: { totalDays: true },
    where: {
      userId: { in: userIds },
      status: LeaveStatus.APPROVED,
      startDate: { gte: startOfYear, lte: endOfYear },
    },
  });
  const monthsElapsed = now.getMonth() + 1;
  const workingDaysElapsed = Math.round((WORKING_DAYS_PER_YEAR / 12) * monthsElapsed);
  const absenteeismRate =
    headcount > 0
      ? Math.round(((approvedDays._sum.totalDays ?? 0) / (headcount * workingDaysElapsed)) * 100 * 10) / 10
      : 0;

  // Objectives
  const objectives = await prisma.objective.findMany({
    where: { userId: { in: userIds }, status: { not: "CANCELLED" } },
    select: { status: true },
  });
  const objectivesByStatus: Record<string, number> = {};
  for (const o of objectives) {
    objectivesByStatus[o.status] = (objectivesByStatus[o.status] || 0) + 1;
  }
  const objTotal = objectives.length;
  const objAchieved = objectives.filter(
    (o) => o.status === "ACHIEVED" || o.status === "PARTIALLY_ACHIEVED"
  ).length;
  const avgObjectiveCompletion = objTotal > 0 ? Math.round((objAchieved / objTotal) * 100) : 0;

  // Mood (last 30 days)
  const moods = await prisma.moodCheckin.findMany({
    where: { userId: { in: userIds }, createdAt: { gte: thirtyDaysAgo } },
    select: { mood: true, createdAt: true },
  });
  const avgMood =
    moods.length > 0
      ? Math.round((moods.reduce((s, m) => s + MOOD_VALUES[m.mood], 0) / moods.length) * 100) / 100
      : null;

  // Mood trend (weekly)
  const moodByWeek: Record<string, { sum: number; count: number }> = {};
  for (const m of moods) {
    const wk = getWeekKey(m.createdAt);
    if (!moodByWeek[wk]) moodByWeek[wk] = { sum: 0, count: 0 };
    moodByWeek[wk].sum += MOOD_VALUES[m.mood];
    moodByWeek[wk].count += 1;
  }
  const moodTrend = Object.entries(moodByWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, d]) => ({
      week,
      avg: Math.round((d.sum / d.count) * 100) / 100,
      count: d.count,
    }));

  // Risk scores (compute for each user)
  const riskResults: Array<{
    id: string;
    firstName: string;
    lastName: string;
    riskScore: number;
    riskLabel: string;
  }> = [];

  for (const u of users) {
    const risk = await computeUserRiskScore(u.id);
    if (risk) {
      riskResults.push({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        riskScore: risk.overall,
        riskLabel: risk.label,
      });
    }
  }

  const avgRiskScore =
    riskResults.length > 0
      ? Math.round(riskResults.reduce((s, r) => s + r.riskScore, 0) / riskResults.length)
      : 0;

  const riskAlerts = riskResults.filter((r) => r.riskScore >= 50).length;
  const topRiskUsers = riskResults
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  return {
    teamId,
    teamName,
    headcount,
    turnoverRate,
    absenteeismRate,
    avgObjectiveCompletion,
    avgMood,
    avgRiskScore,
    riskAlerts,
    moodTrend,
    objectivesByStatus,
    topRiskUsers,
  };
}

// ─── CSV Export ───

export function analyticsToCSV(data: TeamAnalytics): string {
  const lines: string[] = [];
  lines.push("Metric,Value");
  lines.push(`Team,"${data.teamName ?? "Company"}"`);
  lines.push(`Headcount,${data.headcount}`);
  lines.push(`Turnover Rate (%),${data.turnoverRate}`);
  lines.push(`Absenteeism Rate (%),${data.absenteeismRate}`);
  lines.push(`Avg Objective Completion (%),${data.avgObjectiveCompletion}`);
  lines.push(`Avg Mood (1-5),${data.avgMood ?? "N/A"}`);
  lines.push(`Avg Risk Score (0-100),${data.avgRiskScore}`);
  lines.push(`Risk Alerts (score >= 50),${data.riskAlerts}`);
  lines.push("");
  lines.push("Objectives by Status");
  lines.push("Status,Count");
  for (const [status, count] of Object.entries(data.objectivesByStatus)) {
    lines.push(`${status},${count}`);
  }
  lines.push("");
  lines.push("Top Risk Users");
  lines.push("Name,Risk Score,Label");
  for (const u of data.topRiskUsers) {
    lines.push(`"${u.lastName} ${u.firstName}",${u.riskScore},${u.riskLabel}`);
  }
  lines.push("");
  lines.push("Mood Trend (Weekly)");
  lines.push("Week,Average,Check-ins");
  for (const t of data.moodTrend) {
    lines.push(`${t.week},${t.avg},${t.count}`);
  }
  return lines.join("\n");
}

// ─── Helpers ───

function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}
