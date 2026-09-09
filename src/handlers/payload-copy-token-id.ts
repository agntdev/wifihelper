import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { clean } from "../wifi-shared.js";
import { t } from "../i18n.js";
const composer = new Composer<Ctx>();
composer.callbackQuery(/^payload:copy:([a-f0-9]{12})$/, async (ctx) => {
  const token = clean(ctx).tokens.find((t) => t.id === ctx.match[1]);
  if (!token || token.status !== "active") { await ctx.answerCallbackQuery({ text: t(ctx, "unavailable"), show_alert: true }); return; }
  // Telegram callback buttons cannot write to a device clipboard. The payload is
  // already visible only in the message the host intentionally shared; confirm
  // the tap without sending credentials into another chat.
  await ctx.answerCallbackQuery({ text: t(ctx, "copyToast") });
});
export default composer;
