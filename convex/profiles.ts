import { query } from "./_generated/server";
import { v } from "convex/values";

/** Look up a username by userId from the userProfiles table */
export const getUsername = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const prof = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return prof ? prof.username : null;
  },
});
