import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { SECURITY, clean, menuBack, owner, type Security } from "../wifi-shared.js";
registerMainMenuItem({ label: "Settings", data: "settings:open", order: 40 });
const composer = new Composer<Ctx>();
async function show(ctx: Ctx, edit = false) { if (!(await owner(ctx))) return; const d = clean(ctx); const text = `Your defaults: ${d.defaultExpiryHours} hours and ${d.defaultSecurity}.\n${d.profiles.length ? d.profiles.map((p) => `Saved: ${p.ssid} (${p.security})`).join("\n") : "No Wi‑Fi profiles yet."}`; const rows = [[inlineButton("Set 4h default", "settings:hours:4"), inlineButton("Set 24h default", "settings:hours:24")], [inlineButton("Choose security", "settings:security")], [inlineButton("Manage Wi‑Fi", "wifi:set")], ...d.profiles.slice(0, 3).map((p) => [inlineButton(`Delete ${p.ssid}`, `wifi:delete:${p.id}`)]), [inlineButton("Back to menu", "menu:main")]]; const kb = inlineKeyboard(rows); if (edit) await ctx.editMessageText(text, { reply_markup: kb }); else await ctx.reply(text, { reply_markup: kb }); }
composer.command("settings", (ctx) => show(ctx));
composer.callbackQuery("settings:open", async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, true); });
composer.callbackQuery(/^settings:hours:(4|24)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; clean(ctx).defaultExpiryHours = Number(ctx.match[1]); await show(ctx, true); });
composer.callbackQuery("settings:security", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; await ctx.editMessageText("Choose your default security type.", { reply_markup: inlineKeyboard([SECURITY.map((s) => inlineButton(s, `settings:security:${s}`)), [inlineButton("Back", "settings:open")]]) }); });
composer.callbackQuery(/^settings:security:(WPA2|WPA3|WEP|Open)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; clean(ctx).defaultSecurity = ctx.match[1] as Security; await show(ctx, true); });
composer.callbackQuery(/^wifi:delete:([a-f0-9-]+)$/, async (ctx) => { await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; const d = clean(ctx); const used = d.tokens.some((t) => t.profileId === ctx.match[1] && t.status === "active"); if (used) { await ctx.editMessageText("Revoke active guest access before deleting this Wi‑Fi profile.", { reply_markup: menuBack() }); return; } d.profiles = d.profiles.filter((p) => p.id !== ctx.match[1]); await show(ctx, true); });
export default composer;
