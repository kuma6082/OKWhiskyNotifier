/**
 * okWhiskyNotifier() から呼ばれる通知関数
 * 仕様：タイトルに「【処理済み】」が含まれていない当日イベントを Discord に通知
 * ボタンは WebApp(doGet) へ action=complete / action=skip で遷移（style:5）
 */
function notifyDiscordForCalendarEvents() {
  const conf = getConf_();
  const tz = Session.getScriptTimeZone() || 'Asia/Tokyo';

  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay   = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  const cal = conf.calendarId === 'primary'
    ? CalendarApp.getDefaultCalendar()
    : CalendarApp.getCalendarById(conf.calendarId);

  const events = cal.getEvents(startOfDay, endOfDay);
  const targets = events.filter(ev => !(ev.getTitle() || '').includes('【処理済み】'));

  if (!targets.length) {
    Logger.log('当日の通知対象なし');
    return;
  }

  targets.forEach(ev => {
    const title = ev.getTitle();
    const id = ev.getId();
    const when = ev.isAllDayEvent()
      ? Utilities.formatDate(ev.getAllDayStartDate(), tz, 'yyyy/MM/dd') + ' (終日)'
      : Utilities.formatDate(ev.getStartTime(), tz, 'yyyy/MM/dd HH:mm');

    const content = `📌 ${title}`;

    const base = `${conf.webappUrl}?eventId=${encodeURIComponent(id)}&token=${encodeURIComponent(conf.token)}`;
    // ★ ここを completeUrl / skipUrl に統一（エラー対策）
    const completeUrl = `${base}&action=complete`;
    const skipUrl     = `${base}&action=skip`;

    const payload = {
      content,
      // フォールバック：ボタンが出ない環境でもリンクで操作可能
      embeds: [{
        description: [
          `[🔕 申し込み完了](${completeUrl})\n`,
          `[✅ 申込みしない](${skipUrl})`
        ].join('\n')
      }],
      // ボタン（Link Button / style:5）— 見た目重視で 1行1ボタン
      components: [
        {
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: '🔕 申し込み完了',
            url: completeUrl
          }]
        },
        {
          type: 1,
          components: [{
            type: 2,
            style: 5,
            label: '✅ 申込みしない',
            url: skipUrl
          }]
        }
      ]
    };


    const res = UrlFetchApp.fetch(conf.webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true // ← レスポンス本文を確認できるように
    });
    Logger.log(`Discord status: ${res.getResponseCode()}`);
    Logger.log(`Discord body: ${res.getContentText()}`);
  });
}



// function notifyDiscordForCalendarEvents() {
//   const targetKeyword = '国産洋酒の抽選販売実施について';
//   const negativeKeyword = '【申し込み完了】';

//   const today = new Date();
//   const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
//   const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

//   const calendar = CalendarApp.getDefaultCalendar();
//   const events = calendar.getEvents(startOfDay, endOfDay);

//   events.forEach(event => {
//     const title = event.getTitle();
//     if (title.includes(targetKeyword) && !title.startsWith(negativeKeyword)) {
//       const eventId = event.getId(); // 👈 固有IDを取得
//       const message = `📅 **${title}**\n本日抽選申し込み期間です。申し込みしてください。`;
//       sendToDiscord(message, eventId);
//       Utilities.sleep(1000); // 連投対策
//     }
//   });
// }

// function sendToDiscord(content, eventId) {
//   const scriptProperties = PropertiesService.getScriptProperties();
//   let webhookUrl = scriptProperties.getProperty("discord");
//   webhookUrl += (webhookUrl.includes('?') ? '&' : '?') + 'with_components=true';
//   const appUrl = scriptProperties.getProperty("webapp");

//   const payload = {
//     content: content,
//     components: [{
//       type: 1,
//       components: [{
//         type: 2,
//         style: 5,
//         label: '🔕 申し込み完了',
//         url: `${appUrl}?eventId=${encodeURIComponent(eventId)}` // 👈 イベントIDをURLに付与
//       }]
//     }]
//   };

//   UrlFetchApp.fetch(webhookUrl, {
//     method: 'post',
//     contentType: 'application/json',
//     payload: JSON.stringify(payload)
//   });
// }