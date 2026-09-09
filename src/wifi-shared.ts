import type { Ctx, DeliveryMode, GuestToken, WifiData, WifiProfile } from "./bot.js";
import { adminChatId, inlineButton, inlineKeyboard, isOwner } from "./toolkit/index.js";
import { t } from "./i18n.js";

export const SECURITY = ["WPA2", "WPA3", "WEP", "Open"] as const;
export type Security = (typeof SECURITY)[number];
/** Single clock seam for expiry decisions; tests may replace it through `setNow`. */
let clock: () => Date = () => new Date();
export const now = () => clock();
export function setNow(value: () => Date): void { clock = value; }

function data(ctx: Ctx): WifiData {
  return (ctx.session.wifiData ??= { profiles: [], tokens: [], tokenIds: [], defaultExpiryHours: 24, defaultSecurity: "WPA2" });
}
export function clean(ctx: Ctx): WifiData {
  const d = data(ctx); const time = now().toISOString();
  d.tokens.forEach((t) => { if (t.status === "active" && t.expiresAt <= time) t.status = "expired"; });
  return d;
}
export async function owner(ctx: Ctx): Promise<boolean> {
  if (isOwner(ctx as never)) return true;
  const text = adminChatId(ctx as never) ? t(ctx, "ownerOnly") : t(ctx, "ownerUnset");
  try { await ctx.answerCallbackQuery({ text, show_alert: true }); } catch { /* A text command has no callback query. */ }
  await ctx.reply(text);
  return false;
}
export function escapeWifi(value: string): string { return value.replace(/([\\;,:])/g, "\\$1"); }
export function payload(profile: WifiProfile, password: string): string { return `WIFI:T:${profile.security};S:${escapeWifi(profile.ssid)};P:${escapeWifi(password)};;`; }
function bytes(input: Uint8Array): string { return btoa(String.fromCharCode(...input)); }
function fromBytes(input: string): Uint8Array { return Uint8Array.from(atob(input), (c) => c.charCodeAt(0)); }
async function key(ctx: Ctx): Promise<CryptoKey> { const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`wifi-guest:${adminChatId(ctx as never) ?? "unconfigured"}`)); return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]); }
export async function encrypt(ctx: Ctx, value: string): Promise<string> { const iv = crypto.getRandomValues(new Uint8Array(12)); const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(ctx), new TextEncoder().encode(value)); return `${bytes(iv)}.${bytes(new Uint8Array(enc))}`; }
export async function decrypt(ctx: Ctx, value: string): Promise<string> { const [iv, body] = value.split("."); const nonce = fromBytes(iv); const ciphertext = fromBytes(body); const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce as unknown as BufferSource }, await key(ctx), ciphertext as unknown as BufferSource); return new TextDecoder().decode(plain); }
export function id(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 12); }
export async function notify(ctx: Ctx, text: string): Promise<void> { const target = adminChatId(ctx as never); if (!target) return; try { await ctx.api.sendMessage(target, text); } catch { /* A blocked chat must not interrupt the owner flow. */ } }
export function profileSummary(ctx: Ctx, p: WifiProfile): string { return `${t(ctx, "savedProfile")} “${p.ssid}” (${p.security}).`; }
export function menuBack(ctx: Ctx) { return inlineKeyboard([[inlineButton(t(ctx, "back"), "menu:main")]]); }
export async function showGuests(ctx: Ctx, page = 0, edit = false): Promise<void> {
  if (!(await owner(ctx))) return;
  const active = clean(ctx).tokens.filter((t) => t.status === "active").slice(0, 50);
  if (!active.length) { const text = t(ctx, "noGuests"); if (edit) await ctx.editMessageText(text, { reply_markup: menuBack(ctx) }); else await ctx.reply(text, { reply_markup: menuBack(ctx) }); return; }
  const per = 10; const pages = Math.ceil(active.length / per); const current = Math.max(0, Math.min(page, pages - 1)); const rows = active.slice(current * per, current * per + per);
  const text = rows.map((token) => `${token.name || t(ctx, "guest")} · ${t(ctx, "expires")} ${token.expiresAt.replace("T", " ").slice(0, 16)} UTC · ${token.id}`).join("\n");
  const keys = rows.map((token) => [inlineButton(`${t(ctx, "revoke")} ${token.name || t(ctx, "guest")}`, `revoke:${token.id}`), inlineButton(t(ctx, "details"), `guest:${token.id}`)]);
  if (pages > 1) keys.push([...(current ? [inlineButton(t(ctx, "previous"), `guests:${current - 1}`)] : []), ...(current < pages - 1 ? [inlineButton(t(ctx, "next"), `guests:${current + 1}`)] : [])]);
  keys.push([inlineButton(t(ctx, "back"), "menu:main")]);
  const heading = `${t(ctx, "activeGuests")} (${active.length})\n${text}`;
  if (edit) await ctx.editMessageText(heading, { reply_markup: inlineKeyboard(keys) }); else await ctx.reply(heading, { reply_markup: inlineKeyboard(keys) });
}
export async function beginGuest(ctx: Ctx, edit = false): Promise<void> {
  if (!(await owner(ctx))) return;
  if (!clean(ctx).profiles.length) { const text = localeText(ctx, "لومړی د Wi‑Fi شبکه ورزیاته کړئ، بیا د مېلمه لاسرسی جوړولای شئ.", "Add a Wi‑Fi profile first, then you can create guest access."); if (edit) await ctx.editMessageText(text, { reply_markup: inlineKeyboard([[inlineButton(t(ctx, "addWifi"), "wifi:set")]] ) }); else await ctx.reply(text, { reply_markup: inlineKeyboard([[inlineButton(t(ctx, "addWifi"), "wifi:set")]] ) }); return; }
  ctx.session.flow = "guest_name"; ctx.session.draft = {};
  const text = t(ctx, "guestName"); if (edit) await ctx.editMessageText(text); else await ctx.reply(text);
}
function localeText(ctx: Ctx, ps: string, en: string): string { return t(ctx, "welcome") === "Share guest Wi‑Fi without passing around your password." ? en : ps; }
export async function createToken(ctx: Ctx, delivery: DeliveryMode, hours: number): Promise<GuestToken> {
  const d = clean(ctx); const profile = d.profiles[0]; const password = await decrypt(ctx, profile.passwordEncrypted); const created = now(); const token: GuestToken = { id: id(), name: ctx.session.draft?.name, note: ctx.session.draft?.note, profileId: profile.id, payload: payload(profile, password), delivery, code: id().slice(0, 8).toUpperCase(), createdAt: created.toISOString(), expiresAt: new Date(created.getTime() + hours * 3600000).toISOString(), status: "active" };
  d.tokens.push(token); d.tokenIds.push(token.id); ctx.session.flow = undefined; ctx.session.draft = undefined; return token;
}
