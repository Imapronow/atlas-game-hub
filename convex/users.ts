import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createProfile = mutation({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_username", q => q.eq("username", args.username))
      .unique();
    if (existing) throw new Error("Username taken");
    
    await ctx.db.insert("userProfiles", {
      userId,
      username: args.username,
    });
  },
});

export const getProfile = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("userProfiles")
      .filter(q => q.eq(q.field("userId"), userId))
      .unique();
  },
});
