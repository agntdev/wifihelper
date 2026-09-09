import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { registerMainMenuItem, inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { SECURITY, clean, encrypt, menuBack, now, owner, profileSummary, type Security } from "../wifi-shared.js";

registerMainMenuItem({ label: "Wi‑Fi settings", data: "wifi:set", order: 30 });
const composer = new Composer<Ctx>();
async function begin(ctx: Ctx, edit = false) { if (!(await owner(ctx))) return; ctx.session.flow = "wifi_ssid"; ctx.session.draft = {}; const text = "Send the Wi‑Fi network name."; if (edit) await ctx.editMessageText(text); else await ctx.reply(text); }
composer.command("setwifi", (ctx) => begin(ctx));
composer.callbackQuery("wifi:set", async (ctx) => { await ctx.answerCallbackQuery(); await begin(ctx, true); });
composer.callbackQuery(/^wifi:security:(WPA2|WPA3|WEP|Open)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await owner(ctx))) return;
  const security = ctx.match[1] as Security;
  const draft = ctx.session.draft;
  if (!draft?.ssid || draft.password === undefined) { await ctx.editMessageText("That setup timed out. Start Wi‑Fi settings again."); return; }
  const data = clean(ctx);
  const timestamp = now().toISOString();
  const stored = { id: crypto.randomUUID().slice(0, 12), ssid: draft.ssid, passwordEncrypted: await encrypt(ctx, draft.password), security, createdAt: timestamp, updatedAt: timestamp };
  data.profiles = [stored, ...data.profiles.filter((profile) => profile.ssid !== stored.ssid)];
  ctx.session.flow = undefined;
  ctx.session.draft = undefined;
  await ctx.editMessageText(profileSummary(stored), { reply_markup: menuBack() });
});
composer.on("message:text", async (ctx, next) => {
  if (!(await owner(ctx))) return next();
  const text = ctx.message.text.trim();
  if (ctx.session.flow === "wifi_ssid") { if (!text || text.length > 64) { await ctx.reply("That network name is too long. Try again."); return; } ctx.session.draft = { ssid: text }; ctx.session.flow = "wifi_password"; await ctx.reply("Now send the Wi‑Fi password. For an open network, type skip."); return; }
  if (ctx.session.flow === "wifi_password") { ctx.session.draft = { ...ctx.session.draft, password: text.toLowerCase() === "skip" ? "" : text }; await ctx.reply("Choose the network security type.", { reply_markup: inlineKeyboard([SECURITY.map((security) => inlineButton(security, `wifi:security:${security}`))]) }); return; }
  return next();
});
export default composer;
