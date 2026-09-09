import { Composer } from "grammy";

// SCAFFOLD — generated from the bot blueprint BEFORE the agent runs.
// Keep a LIVE registration (.command / .callbackQuery / …) so this feature is
// never an empty stub. Replace the reply body with real logic + copy; if you
// change the user-facing text, update tests/specs to match EXACTLY.
// Do NOT rewrite src/bot.ts — buildBot() already auto-loads this module.

const composer = new Composer();

composer.command("listguests", async (ctx) => {
  await ctx.reply("List active guest accesses (paginated if \u003e 10), up to max 50 results per brief default");
});

export default composer;
