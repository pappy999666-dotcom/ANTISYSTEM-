/**
 * PAPPYBOT V2 — Registration Handler
 */

import type { Bot } from 'grammy';
import { telegramStore } from '../core/TelegramStore';
import {
  welcomeScreen,
  domainPrompt,
  registrationComplete,
  dashboardText,
  dashboardKeyboard,
} from '../ui/UIBuilder';
import type { RuntimeMonitor } from '../../services/RuntimeMonitor';

export function registerRegistrationHandlers(bot: Bot, monitor: RuntimeMonitor): void {

  bot.command('start', async (ctx) => {
    const id = ctx.from!.id;
    const firstName = ctx.from!.first_name ?? 'there';

    if (telegramStore.isRegistered(id)) {
      const user = telegramStore.requireUser(id);
      const snap = monitor.snapshot();
      await ctx.reply(dashboardText(snap, user), {
        parse_mode: 'HTML',
        reply_markup: dashboardKeyboard(),
      });
      return;
    }

    telegramStore.setStep(id, 'awaiting_name');
    await ctx.reply(welcomeScreen(firstName), { parse_mode: 'HTML' });
  });

  bot.command('skip', async (ctx) => {
    const id = ctx.from!.id;
    if (telegramStore.getStep(id) === 'awaiting_domain') {
      const name = telegramStore.getTempName(id) ?? ctx.from!.first_name;
      const user = telegramStore.createUser(id, name);
      telegramStore.clearStep(id);
      await ctx.reply(registrationComplete(user), { parse_mode: 'HTML' });
    }
  });
}

/** Called from the main text router — handles registration steps */
export async function handleRegistrationText(
  id: number,
  text: string,
  firstName: string,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const step = telegramStore.getStep(id);

  if (step === 'awaiting_name') {
    if (text.length < 2 || text.length > 32) {
      await reply('⚠️ Name must be 2–32 characters. Try again:');
      return true;
    }
    telegramStore.users_setTempName(id, text);
    telegramStore.setStep(id, 'awaiting_domain');
    await reply(domainPrompt(), { parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
    return true;
  }

  if (step === 'awaiting_domain') {
    const domain = text.startsWith('http') ? text : `https://${text}`;
    const name = telegramStore.getTempName(id) ?? firstName;
    const user = telegramStore.createUser(id, name, domain);
    telegramStore.clearStep(id);
    await reply(registrationComplete(user), { parse_mode: 'HTML' });
    return true;
  }

  return false;
}
