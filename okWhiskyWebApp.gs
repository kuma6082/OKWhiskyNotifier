// function doGet() {
//   // 今日 00:00 〜 明日 00:00
//   const tz   = 'Asia/Tokyo';
//   const now  = new Date();
//   const start= new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const end  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

//   const calendar = CalendarApp.getDefaultCalendar();
//   const events   = calendar.getEvents(start, end);

//   events.forEach(ev => {
//     const title = ev.getTitle();
//     if (title.includes('OKストア:国産洋酒') && !title.startsWith('【申し込み完了】')) {
//       ev.setTitle('【申し込み完了】' + title);
//     }
//   });

//   return ContentService.createTextOutput('done');
// }

function doGet() {
  markTodayAsDone_();                       // ← 既存ロジック

  // HTML テンプレートを読み込み、タイムスタンプを渡す（任意）
  const tpl = HtmlService.createTemplateFromFile('complete');
  tpl.doneAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return tpl.evaluate()
            .setTitle('完了しました')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL); // Discord 内プレビュー対策
}

/** 既存のタイトル書き換え処理だけ切り出し */
function markTodayAsDone_() {
  const TARGET = 'OKストア:国産洋酒';
  const DONE   = '【申し込み完了】';

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  CalendarApp.getDefaultCalendar()
    .getEvents(start, end)
    .filter(ev => ev.getTitle().includes(TARGET) && !ev.getTitle().startsWith(DONE))
    .forEach(ev => ev.setTitle(DONE + ev.getTitle()));
}
