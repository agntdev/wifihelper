// @ts-ignore qrcode publishes typings only for its Node entry; this is its browser entry.
import QRCode from "qrcode/lib/browser.js";
import { Composer, InputFile } from "grammy";
import type { Ctx, DeliveryMode } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { beginGuest, createToken, notify, owner } from "../wifi-shared.js";

registerMainMenuItem({ label: "Create guest", data: "guest:create", order: 10 });
const composer = new Composer<Ctx>();

composer.command("newguest", (ctx) => beginGuest(ctx));
composer.callbackQuery(/^guest:delivery:(qr|text|code)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await owner(ctx))) return;
  ctx.session.draft = { ...ctx.session.draft, delivery: ctx.match[1] as DeliveryMode };
  await ctx.editMessageText("Choose when this access expires.", { reply_markup: inlineKeyboard([[inlineButton("4 hours", "guest:expiry:4"), inlineButton("12 hours", "guest:expiry:12")], [inlineButton("24 hours", "guest:expiry:24"), inlineButton("7 days", "guest:expiry:168")], [inlineButton("Custom hours", "guest:expiry:custom")]]) });
});
composer.callbackQuery(/^guest:expiry:(\d+|custom)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  if (!(await owner(ctx))) return;
  if (ctx.match[1] === "custom") { ctx.session.flow = "guest_expiry"; await ctx.editMessageText("Send a whole number of hours, from 1 to 168."); return; }
  await deliver(ctx, Number(ctx.match[1]));
});
async function deliver(ctx: Ctx, hours: number) {
  if (!Number.isInteger(hours) || hours < 1 || hours > 168 || !ctx.session.draft?.delivery) { await ctx.reply("Use a whole number of hours from 1 to 168."); return; }
  const token = await createToken(ctx, ctx.session.draft.delivery, hours);
  const details = `Access for ${token.name || "your guest"} expires ${token.expiresAt.replace("T", " ").slice(0, 16)} UTC.`;
  const keys = inlineKeyboard([[inlineButton("Copy payload", `payload:copy:${token.id}`), inlineButton("Revoke", `revoke:${token.id}`)], [inlineButton("View guests", "guests:0")]]);
  if (token.delivery === "qr") {
    try {
      const svg = await QRCode.toString(token.payload, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 600 });
      await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(svg), "wifi-guest-qr.svg"), { caption: `${details}\nToken ${token.id}`, reply_markup: keys });
    } catch {
      await ctx.reply(`Couldn't make the QR image, so here's the Wi‑Fi payload:\n${token.payload}`, { reply_markup: keys });
      await notify(ctx, `Wi‑Fi QR fallback for token ${token.id}.`);
    }
  } else if (token.delivery === "code") await ctx.reply(`${details}\nTemporary code: ${token.code}`, { reply_markup: keys });
  else await ctx.reply(`${details}\n${token.payload}`, { reply_markup: keys });
  await notify(ctx, `Guest access created for ${token.name || "a guest"}. ${token.delivery} delivery, expires ${token.expiresAt}, token ${token.id}.`);
}
composer.on("message:text", async (ctx, next) => {
  if (!(await owner(ctx))) return next();
  const text = ctx.message.text.trim();
  if (ctx.session.flow === "guest_name") { ctx.session.draft = { ...ctx.session.draft, name: text.toLowerCase() === "skip" ? undefined : text.slice(0, 80) }; ctx.session.flow = "guest_note"; await ctx.reply("Add a note, or type skip."); return; }
  if (ctx.session.flow === "guest_note") { ctx.session.draft = { ...ctx.session.draft, note: text.toLowerCase() === "skip" ? undefined : text.slice(0, 240) }; await ctx.reply("Choose how to share access.", { reply_markup: inlineKeyboard([[inlineButton("QR code", "guest:delivery:qr"), inlineButton("Plain text", "guest:delivery:text")], [inlineButton("Temporary code", "guest:delivery:code")]]) }); return; }
  if (ctx.session.flow === "guest_expiry") { await deliver(ctx, Number(text)); return; }
  return next();
});
export default composer;
