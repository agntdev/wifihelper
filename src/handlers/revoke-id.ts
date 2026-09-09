import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { confirmKeyboard, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { clean, notify, now, owner } from "../wifi-shared.js";
import { t } from "../i18n.js";
const composer = new Composer<Ctx>();
async function ask(ctx: Ctx, tokenId: string, edit = false) { if (!(await owner(ctx))) return; const token = clean(ctx).tokens.find((x) => x.id === tokenId); if (!token || token.status !== "active") { const text = t(ctx, "alreadyUnavailable"); if (edit) await ctx.editMessageText(text); else await ctx.reply(text); return; } const text = token.name ? `${t(ctx, "revoke")} ${token.name}?` : t(ctx, "revokeAsk"); const keyboard = confirmKeyboard(`revoke:${tokenId}`, { yes: t(ctx, "revoke"), no: t(ctx, "cancel") }); if (edit) await ctx.editMessageText(text, { reply_markup: keyboard }); else await ctx.reply(text, { reply_markup: keyboard }); }
composer.command("revoke", async (ctx) => { const tokenId = ctx.match?.trim(); if (!tokenId) { await ctx.reply(t(ctx, "chooseGuest")); return; } await ask(ctx, tokenId); });
composer.callbackQuery(/^revoke:([a-f0-9]{12})$/, async (ctx) => { await ctx.answerCallbackQuery(); await ask(ctx, ctx.match[1], true); });
composer.callbackQuery(/^revoke:([a-f0-9]{12}):(yes|no)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; const token = clean(ctx).tokens.find((x) => x.id === ctx.match[1]); if (ctx.match[2] === "no") { await ctx.editMessageText(t(ctx, "keptActive")); return; } if (!token || token.status !== "active") { await ctx.editMessageText(t(ctx, "alreadyUnavailable")); return; } token.status = "revoked"; token.revokedAt = now().toISOString(); await ctx.editMessageText(`${t(ctx, "revoke")} ${token.name || t(ctx, "guest")}.`, { reply_markup: inlineKeyboard([[inlineButton(t(ctx, "viewGuests"), "guests:0")]]) }); await notify(ctx, `${t(ctx, "revokedNotice")}: ${t(ctx, "token")} ${token.id}.`); });
export default composer;
