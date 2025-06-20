function notifyDiscordForCalendarEvents() {
  // 特定の文字列を指定
  const targetKeyword = 'OKストア:国産洋酒';
  const negativeKeyword = '【申し込み完了】';

  // 今日の日付
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  // Googleカレンダーの予定を取得
  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEvents(startOfDay, endOfDay);

  // 通知用のメッセージを作成
  let message = "";

  events.forEach(event => {
    if (event.getTitle().includes(targetKeyword) &&
        !event.getTitle().startsWith(negativeKeyword)) {
      const eventTitle = "本日抽選申し込み期間です。申し込みしてください。"
      message += `**${eventTitle}**`;
    }
  });

  if (message) {
    sendToDiscord(`📅 \n${message}`);
  }else{
    Logger.log("本日抽選申し込み期間ではありません");
  }
}

function sendToDiscord(content) {
var scriptProperties = PropertiesService.getScriptProperties();
var webhookUrl = scriptProperties.getProperty("discord");
webhookUrl += (webhookUrl.includes('?') ? '&' : '?') + 'with_components=true';
const appUrl  = scriptProperties.getProperty("webapp");
let payload;

if (content.includes('本日抽選申し込み期間です。申し込みしてください。')){
  payload = {
    content: content,
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '🔕 申し込み完了',
        url: appUrl
      }]
    }]
  };
}else{
  payload = {content: content}
}

   UrlFetchApp.fetch(webhookUrl, {
     method: 'post',
     contentType: 'application/json',
     payload: JSON.stringify(payload)
   });
}

