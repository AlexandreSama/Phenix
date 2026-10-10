// src/metrics.ts — valeurs possibles de DailyMetric.metric
export const METRICS = {
    interactions: "interactions",
    messages: "messages",
    xpGained: "xp_gained",
    membersJoined: "members_joined",
    membersLeft: "members_left",
    activeUsers: "active_users",
} as const;

export type MetricName = (typeof METRICS)[keyof typeof METRICS];