export async function sendTelegramMessage(chatId: string, message: string) {
  const token = process.env.BOT_TOKEN;
  if (!token) {
    console.error('Telegram BOT_TOKEN is not configured.');
    return;
  }
  if (!chatId) {
    console.error('Telegram Chat ID is not configured.');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Failed to send Telegram message:', errorData);
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
}
