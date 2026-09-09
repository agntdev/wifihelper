import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { clean } from "../wifi-shared.js";

const composer = new Composer<Ctx>();
composer.callbackQuery(/^payload:copy:([a-f0-9]{12})$/, async (ctx) => {
  const token = clean(ctx).tokens.find((token) => token.id === ctx.match[1]);
  if (!token || token.status !== "active") { await ctx.answerCallbackQuery({ text: "That access is no longer available.", show_alert: true }); return; }
  await ctx.answerCallbackQuery({ text: "Copy the Wi‑Fi text from this message." });
});
export default composer;
