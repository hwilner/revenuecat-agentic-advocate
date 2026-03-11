import { getEnv } from './env';

/**
 * Sends a message to a Telegram chat.
 *
 * Tries Markdown first; if Telegram rejects the formatting,
 * falls back to plain text so the notification still arrives.
 *
 * Args:
 *   text: Message to send.
 */
export async function sendTelegramMessage(text: string) {
  const env = getEnv();
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  // Try with Markdown first.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (res.ok) return;

  // If Markdown parsing failed, retry without parse_mode (plain text).
  const fallback = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!fallback.ok) {
    const body = await fallback.text();
    // Log but do not throw — Telegram failures should not crash the agent.
    console.error(`Telegram sendMessage failed: ${fallback.status} ${body}`);
  }
}
