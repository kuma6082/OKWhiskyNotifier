function notifyDiscordForCalendarEvents() {
  const targetKeyword = '国産洋酒の抽選販売実施について';
  const negativeKeyword = '【処理済み】';

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEvents(startOfDay, endOfDay);

  events.forEach(event => {
    const title = event.getTitle();
    if (title.includes(targetKeyword) && !title.startsWith(negativeKeyword)) {
      const eventId = event.getId(); // 👈 固有IDを取得
      const message = `📅 **${title}**\n本日抽選申し込み期間です。申し込みしてください。`;
      sendToDiscord(message, eventId);
      Utilities.sleep(1000); // 連投対策
    }
  });
}

function sendToDiscord(content, eventId) {
  const scriptProperties = PropertiesService.getScriptProperties();
  let webhookUrl = scriptProperties.getProperty("DISCORD_WEBHOOK_URL");
  webhookUrl += (webhookUrl.includes('?') ? '&' : '?') + 'with_components=true';
  const appUrl = scriptProperties.getProperty("WEBAPP_URL");

  const payload = {
    content: content,
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '🔕 申し込み完了',
        url: `${appUrl}?eventId=${encodeURIComponent(eventId)}` // 👈 イベントIDをURLに付与
      }]
    }]
  };

  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });
}