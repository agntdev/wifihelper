import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";
import { t } from "../i18n.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

function menu(ctx: Ctx) { return inlineKeyboard([[inlineButton(t(ctx, "createGuest"), "guest:create"), inlineButton(t(ctx, "listGuests"), "guests:0")], [inlineButton(t(ctx, "wifiSettings"), "wifi:set"), inlineButton(t(ctx, "settings"), "settings:open")], [inlineButton(t(ctx, "helpButton"), "menu:help")]]); }

composer.command("start", async (ctx) => {
  await ctx.reply(t(ctx, "welcome"), { reply_markup: menu(ctx) });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(ctx, "welcome"), { reply_markup: menu(ctx) });
});

export default composer;
