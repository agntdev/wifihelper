import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { SECURITY, clean, encrypt, menuBack, now, owner, profileSummary, type Security } from "../wifi-shared.js";
import { t } from "../i18n.js";

registerMainMenuItem({ label: "د Wi‑Fi امستنې", data: "wifi:set", order: 30 });
const composer = new Composer<Ctx>();
async function begin(ctx: Ctx, edit = false) { if (!(await owner(ctx))) return; ctx.session.flow = "wifi_ssid"; ctx.session.draft = {}; const text = t(ctx, "ssidPrompt"); if (edit) await ctx.editMessageText(text); else await ctx.reply(text); }
composer.command("setwifi", (ctx) => begin(ctx));
composer.callbackQuery("wifi:set", async (ctx) => { await ctx.answerCallbackQuery(); await begin(ctx, true); });
composer.callbackQuery(/^wifi:security:(WPA2|WPA3|WEP|Open)$/, async (ctx) => {
  await ctx.answerCallbackQuery(); if (!(await owner(ctx))) return; const security = ctx.match[1] as Security; const draft = ctx.session.draft; if (!draft?.ssid || draft.password === undefined) { await ctx.editMessageText(t(ctx, "setupTimedOut")); return; }
  const d = clean(ctx); const timestamp = now().toISOString(); const stored = { id: crypto.randomUUID().slice(0, 12), ssid: draft.ssid, passwordEncrypted: await encrypt(ctx, draft.password), security, createdAt: timestamp, updatedAt: timestamp };
  d.profiles = [stored, ...d.profiles.filter((p) => p.ssid !== stored.ssid)]; ctx.session.flow = undefined; ctx.session.draft = undefined;
  await ctx.editMessageText(profileSummary(ctx, stored), { reply_markup: menuBack(ctx) });
});
composer.on("message:text", async (ctx, next) => {
  if (!(await owner(ctx))) return next(); const text = ctx.message.text.trim();
  if (ctx.session.flow === "wifi_ssid") { if (!text || text.length > 64) { await ctx.reply(t(ctx, "networkTooLong")); return; } ctx.session.draft = { ssid: text }; ctx.session.flow = "wifi_password"; await ctx.reply(t(ctx, "passwordPrompt")); return; }
  if (ctx.session.flow === "wifi_password") { ctx.session.draft = { ...ctx.session.draft, password: text.toLowerCase() === "skip" ? "" : text }; await ctx.reply(t(ctx, "chooseSecurity"), { reply_markup: inlineKeyboard([SECURITY.map((s) => inlineButton(s, `wifi:security:${s}`))]) }); return; }
  return next();
});
export default composer;
