import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { beginGuest } from "../wifi-shared.js";
const composer = new Composer<Ctx>();
composer.callbackQuery("guest:create", async (ctx) => { await ctx.answerCallbackQuery(); await beginGuest(ctx, true); });
export default composer;
