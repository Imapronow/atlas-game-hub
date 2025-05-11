import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

/*──────────────── helpers ─────────────*/
const now = () => Date.now();

/*────────── configs shared with client (keep in sync) ─────────*/
export const STAGE_MS  = 10_000;              // 10 s per stage
export const SPEEDS    = [3, 4, 6, 8, 12];    // 5 stages

/*──────────────── mutations ───────────*/
export const startSession = mutation({
  args: {
    sessionId: v.string(),
    config:   v.any(),                // client passes full GameConfig
  },
  handler: async (ctx, { sessionId, config }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthenticated");

    const dup = await ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first();
    if (dup) return;

    await ctx.db.insert("gameSessions", {
      sessionId,
      createdBy: userId,
      startedAt: now(),
      status:    "active",
      config,
      stage:     0,
      finalScore: undefined,
    });
  },
});

export const updateStage = mutation({
  args: { sessionId: v.string(), stage: v.number() },
  handler: async (ctx, { sessionId, stage }) => {
    await ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first()
      .then(sess => {
        if (!sess || sess.status !== "active") return;
        if (stage === sess.stage) return;        // no-op
        ctx.db.patch(sess._id as Id<"gameSessions">, { stage });
      });
  },
});

export const endSession = mutation({
  args: { sessionId: v.string(), finalScore: v.number() },
  handler: async (ctx, { sessionId, finalScore }) => {
    const sess = await ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first();
    if (!sess) return;
    await ctx.db.patch(sess._id as Id<"gameSessions">, {
      status: "done",
      finalScore,
    });
  },
});

export const logEvent = mutation({
  args: {
    sessionId: v.string(),
    idx:       v.number(),
    t:         v.number(),
    type:      v.union(v.literal("jump"), v.literal("spawn")),
    data:      v.any(),
  },
  handler: async (ctx, { sessionId, ...rest }) => {
    const sess = await ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first();
    if (!sess || sess.status !== "active") return;

    await ctx.db.insert("gameEvents", { sessionId: sess._id, ...rest });
  },
});

/*──────────────── queries ─────────────*/
export const listActiveSessions = query({
  handler: async (ctx) =>
    ctx.db
      .query("gameSessions")
      .withIndex("by_status", q => q.eq("status", "active"))
      .order("asc")
      .collect(),
});

export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) =>
    ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first(),
});

export const eventsSince = query({
  args: { sessionId: v.string(), afterIdx: v.number(), limit: v.optional(v.number()) },
  handler: async (ctx, { sessionId, afterIdx, limit = 256 }) => {
    const sess = await ctx.db
      .query("gameSessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", sessionId))
      .first();
    if (!sess) return [];

    return ctx.db
      .query("gameEvents")
      .withIndex("by_session_idx", q =>
        q.eq("sessionId", sess._id as Id<"gameSessions">).gt("idx", afterIdx)
      )
      .order("asc")
      .take(limit);
  },
});

export const topScores = query({
  handler: async (ctx) =>
    ctx.db
      .query("gameSessions")
      .withIndex("by_status", q => q.eq("status", "done"))
      .order("desc")              // by _id first
      .collect()
      .then(arr =>
        arr
          .filter(s => s.finalScore !== undefined)
          .sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0))
          .slice(0, 10)
      ),
});
