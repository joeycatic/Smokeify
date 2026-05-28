import "server-only";

const TELEGRAM_MESSAGE_LIMIT = 3500;

export type TelegramSendResult = {
  ok: boolean;
  status: number;
  skipped?: boolean;
};

type SendTelegramMessageOptions = {
  text: string;
  token?: string | null;
  chatId?: string | null;
  disableWebPagePreview?: boolean;
};

export const truncateTelegramText = (text: string, limit = TELEGRAM_MESSAGE_LIMIT) =>
  text.length > limit ? `${text.slice(0, Math.max(0, limit - 3))}...` : text;

export async function sendTelegramMessage({
  text,
  token = process.env.TELEGRAM_BOT_TOKEN,
  chatId = process.env.TELEGRAM_CHAT_ID,
  disableWebPagePreview = true,
}: SendTelegramMessageOptions): Promise<TelegramSendResult> {
  if (!token || !chatId) {
    return { ok: false, status: 0, skipped: true };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: truncateTelegramText(text),
        disable_web_page_preview: disableWebPagePreview,
      }),
    });

    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
