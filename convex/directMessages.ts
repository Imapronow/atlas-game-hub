// convex/directMessages.ts

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const now = () => Date.now();

export const sendDirectMessage = mutation({
  args: {
    toUserId: v.id("users"),
    content:  v.string(),
  },
  handler: async (ctx, { toUserId, content }) => {
    const fromUserId = await getAuthUserId(ctx);
    if (!fromUserId) throw new Error("Not authenticated");
    await ctx.db.insert("directMessages", {
      fromUserId,
      toUserId,
      content,
      createdAt: now(),
    });
  },
});

export const listDirectMessages = query({
  args: {
    userA: v.id("users"),
    userB: v.id("users"),
  },
  handler: async (ctx, { userA, userB }) => {
    // Fetch all and filter for this pair
    const msgs = await ctx.db
      .query("directMessages")
      .withIndex("by_createdAt", (q) => q.gt("createdAt", 0))
      .collect();
    return msgs.filter(
      (m) =>
        (m.fromUserId === userA && m.toUserId === userB) ||
        (m.fromUserId === userB && m.toUserId === userA)
    );
  },
});
