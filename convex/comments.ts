import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const sendComment = mutation({
  args: { content: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", q => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("Profile not found");
    
    await ctx.db.insert("comments", {
      userId,
      username: profile.username,
      content: args.content,
    });
  },
});

export const listComments = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("comments")
      .order("desc")
      .take(50);
  },
});
