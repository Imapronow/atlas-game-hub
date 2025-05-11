/*  ---------------------------------------------------------------
    convex/schema.ts – final authoritative schema
    --------------------------------------------------------------- */

import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/*──────────────────── user, chat, etc. ────────────────────*/
const applicationTables = {
  userProfiles: defineTable({
    userId:   v.id("users"),
    username: v.string(),
  })
    .index("by_username", ["username"])
    .index("by_userId",   ["userId"]),

  comments: defineTable({
    userId:   v.id("users"),
    username: v.string(),
    content:  v.string(),
  }),
};

/*────────────────── gameplay / replay tables ──────────────*/
const multiplayerTables = {
  gameSessions: defineTable({
    sessionId:  v.string(),         // UUID
    createdBy:  v.id("users"),
    startedAt:  v.number(),         // ms epoch
    status:     v.union(v.literal("active"), v.literal("done")),
    /* 1–5 speed stages, updated by publisher */
    stage:      v.optional(v.number()),
    /* game constants – may evolve, so keep flexible */
    config:     v.any(),
    finalScore: v.optional(v.number()),
  })
    .index("by_status",    ["status"])
    .index("by_sessionId", ["sessionId"]),

  gameEvents: defineTable({
    sessionId: v.id("gameSessions"),
    idx:       v.number(),                               // monotone
    t:         v.number(),                               // ms since start
    type:      v.union(v.literal("jump"), v.literal("spawn")),
    data: v.union(
      v.object({ playerId: v.string() }),                // jump
      v.object({ x: v.number(), w: v.number(), h: v.number() }) // spawn
    ),
  })
    .index("by_session_idx", ["sessionId", "idx"]),
};

/*───────────────────────── export ─────────────────────────*/
export default defineSchema({
  ...authTables,
  ...applicationTables,
  ...multiplayerTables,
});
