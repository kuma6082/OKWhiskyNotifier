function doGet(e) {
  Logger.log(e.parameter);
  const eventId = e?.parameter?.eventId;
  if (eventId) {
    markEventAsDone_(eventId); // 👈 対象イベントのみ完了処理
  }

  const tpl = HtmlService.createTemplateFromFile('complete');
  tpl.doneAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return tpl.evaluate()
            .setTitle('完了しました')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 特定のイベントIDを「完了」に変更する
 */
function markEventAsDone_(eventId) {
  const DONE = '【申し込み完了】';
  const TARGET = '国産洋酒の抽選販売実施について';

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const events = CalendarApp.getDefaultCalendar().getEvents(start, end);

  // イベントIDを正規化（@より前の部分だけ比較）
  const normalizedId = eventId.split('@')[0];

  // 部分一致で検索
  const targetEvent = events.find(ev => ev.getId().split('@')[0] === normalizedId);

  if (targetEvent) {
    const title = targetEvent.getTitle();
    if (title.includes(TARGET) && !title.startsWith(DONE)) {
      targetEvent.setTitle(DONE + title);
      Logger.log(`✅ イベント更新: ${title}`);
    } else {
      Logger.log(`⚠️ すでに完了済み、または対象外: ${title}`);
    }
  } else {
    Logger.log(`❌ 該当イベントが見つかりません (eventId=${eventId})`);
  }
}