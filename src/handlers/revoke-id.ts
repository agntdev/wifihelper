import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { clean, notify, now, owner } from "../wifi-shared.js";

const composer = new Composer<Ctx>();
async function ask(ctx: Ctx, tokenId: string, edit = false) {
  if (!(await owner(ctx))) return;
  const token = clean(ctx).tokens.find((item) => item.id === tokenId);
  if (!token || token.status !== "active") { const text = "That guest access is already unavailable."; if (edit) await ctx.editMessageText(text); else await ctx.reply(text); return; }
  const text = `Revoke access for ${token.name || "this guest"}?`;
  const keyboard = confirmKeyboard(`revoke:${tokenId}`, { yes: "Revoke", no: "Cancel" });
  if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }); else await ctx.reply(text, { reply_markup: keyboard });
}
composer.command("revoke", async (ctx) => { const tokenId = ctx.match?.trim(); if (!tokenId) { await ctx.reply("Choose a guest from List guests to revoke access."); return; } await ask(ctx, tokenId); });
composer.callbackQuery(/^revoke:([a-f0-9]{12})$/, async (ctx) => { await ctx.answerCallbackQuery(); await ask(ctx, ctx.match[1], true); });
composer.callbackQuery(/^revoke:([a-f0-9]{12}):(yes|no)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await owner(ctx))) return;
  const token = clean(ctx).tokens.find((item) => item.id === ctx.match[1]);
  if (ctx.match[2] === "no") { await ctx.editMessageText("Kept that guest access active."); return; }
  if (!token || token.status !== "active") { await ctx.editMessageText("That guest access is already unavailable."); return; }
  token.status = "revoked";
  token.revokedAt = now().toISOString();
  await ctx.editMessageText(`Revoked access for ${token.name || "this guest"}.`, { reply_markup: inlineKeyboard([[inlineButton("View guests", "guests:0")]]) });
  await notify(ctx, `Guest access revoked by the owner: token ${token.id}.`);
});
export default composer;
