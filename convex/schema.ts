// convex/schema.ts

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

  // ─────────── new direct messages table ───────────
  directMessages: defineTable({
    fromUserId: v.id("users"),
    toUserId:   v.id("users"),
    content:    v.string(),
    createdAt:  v.number(),
  })
    .index("by_createdAt", ["createdAt"]),
};

/*────────────────── gameplay / replay tables ──────────────*/
const multiplayerTables = {
  gameSessions: defineTable({
    sessionId:  v.string(),
    createdBy:  v.id("users"),
    startedAt:  v.number(),
    status:     v.union(v.literal("active"), v.literal("done")),
    stage:      v.optional(v.number()),
    config:     v.any(),
    finalScore: v.optional(v.number()),
  })
    .index("by_status",    ["status"])
    .index("by_sessionId", ["sessionId"]),

  gameEvents: defineTable({
    sessionId: v.id("gameSessions"),
    idx:       v.number(),
    t:         v.number(),
    type:      v.union(v.literal("jump"), v.literal("spawn")),
    data:      v.union(
      v.object({ playerId: v.string() }),
      v.object({ x: v.number(), w: v.number(), h: v.number() })
    ),
  })
    .index("by_session_idx", ["sessionId", "idx"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
  ...multiplayerTables,
});
