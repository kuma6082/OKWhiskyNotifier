/**
 * Discord のボタンから遷移してくる Web エンドポイント
 *   ?action=complete|skip & eventId=... & token=...
 * 仕様：
 *  - token 検証
 *  - complete:  元イベント description から当選発表日を抽出 → 新規（終日）イベント「【抽選結果確認】…」作成 → 元イベントに【処理済み】付与
 *  - skip:      元イベントに【処理済み】付与（新規作成なし）
 *  - 完了画面(complete.html)を返す
 */
function doGet(e) {
  const conf = getConf_();
  const p = e && e.parameter ? e.parameter : {};
  const action  = (p.action || '').toLowerCase();
  const eventId = p.eventId || '';
  const token   = p.token || '';

  if (token !== conf.token) {
    return HtmlService.createHtmlOutput('<h1>403 Forbidden</h1><p>Token invalid.</p>')
      .setTitle('Forbidden');
  }
  if (!eventId || !action || !['complete','skip'].includes(action)) {
    return HtmlService.createHtmlOutput('<h1>400 Bad Request</h1><p>Invalid parameters.</p>')
      .setTitle('Bad Request');
  }

  const event = resolveEventById_(eventId, conf.calendarId);
  if (!event) {
    return HtmlService.createHtmlOutput('<h1>404 Not Found</h1><p>イベントが見つかりませんでした。</p>')
      .setTitle('Not Found');
  }

  // 処理本体
  if (action === 'complete') {
    processComplete_(event, conf.calendarId);
  } else if (action === 'skip') {
    markProcessed_(event);
  }

  // 完了画面
  const tpl = HtmlService.createTemplateFromFile('complete');
  tpl.doneAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return tpl.evaluate()
    .setTitle('完了しました')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** ─────────────────────────────────────────────────────────
 *  ここからロジック
 * ───────────────────────────────────────────────────────── */

/** eventId から CalendarApp.Event を引く（@google.com サフィックス差異に耐性あり） */
function resolveEventById_(rawId, calendarId) {
  const cal = (calendarId && calendarId !== 'primary')
    ? CalendarApp.getCalendarById(calendarId)
    : CalendarApp.getDefaultCalendar();

  // まずは素直に
  try {
    const ev = CalendarApp.getEventById(rawId);
    if (ev) return ev;
  } catch (_) {}

  // サフィックスを落として部分一致検索
  const normalized = String(rawId).split('@')[0];
  // 直近1ヶ月を探索（念のためのフォールバック）
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15);
  const to   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 45);
  const list = cal.getEvents(from, to);
  return list.find(ev => (ev.getId() || '').split('@')[0] === normalized) || null;
}

/** 完了（= 新規終日イベントを作成し、元イベントへ【処理済み】） */
function processComplete_(event, calendarId) {
  const title = event.getTitle() || '';
  const desc  = event.getDescription() || '';

  // 1) description から「当選発表日」を抽出
  const ann = parseAnnouncement_(desc);
  if (!ann) {
    // 発表日が取れない場合でも、とりあえず処理済みだけは付ける
    markProcessed_(event);
    Logger.log('⚠️ 当選発表日が抽出できなかったため、新規イベントは作成しません。');
    return;
  }

  // 2) 新規（終日）イベントを作成
  const cal = (calendarId && calendarId !== 'primary')
    ? CalendarApp.getCalendarById(calendarId)
    : CalendarApp.getDefaultCalendar();

  const newTitle = `【抽選結果確認】${stripProcessedTag_(title)}`;
  const start = new Date(ann.getFullYear(), ann.getMonth(), ann.getDate());
  const end   = new Date(ann.getFullYear(), ann.getMonth(), ann.getDate() + 1);

  const newEv = cal.createAllDayEvent(newTitle, start, end, {
    description: `この日は抽選結果の確認日です。\n元イベント: ${title}`
  });
  Logger.log(`🆕 作成: ${newEv.getTitle()} (${Utilities.formatDate(start, 'Asia/Tokyo', 'yyyy/MM/dd')})`);

  // 3) 元イベントへ【処理済み】を付与
  markProcessed_(event);
}

/** 元イベントに【処理済み】を付与（重複付与はしない） */
function markProcessed_(event) {
  const t = event.getTitle() || '';
  if (!t.includes('【処理済み】')) {
    event.setTitle('【処理済み】' + t);
    Logger.log(`✅ 処理済みに更新: ${t}`);
  } else {
    Logger.log(`↔ すでに処理済み: ${t}`);
  }
}

/** 既に付いているタグを2重にしないための整形 */
function stripProcessedTag_(t) {
  return String(t || '').replace(/^【処理済み】/,'').trim();
}

/**
 * description から当選発表日を抽出
 *  - パターン例:
 *    「当選発表日: 2025/11/21(金) 10:00以降」
 *    「当選発表日：2025-11-21」
 *    「抽選結果は 2025/11/21 10:00 以降に…」
 *  - 取得できた日付の “日付部分のみ” を使って終日イベントを作成
 */
/**
 * description から当選発表日を抽出して Date を返す
 * 対応フォーマット:
 *  - 2025/11/21, 2025-11-21
 *  - 2025年11月21日（曜日） ※全角数字や全角スペース混入もOK
 *  - 「当選発表日: ...」「抽選結果は ... 以降」などの前置き文あり/なし両対応
 */
function parseAnnouncement_(desc) {
  if (!desc) return null;
  const raw = String(desc);

  // 全角→半角、改行やタブをスペース化、余分な空白圧縮
  const text = toHalfWidth_(raw)
    .replace(/[\u3000\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1) 「当選発表日」行を優先的に取り出し（あれば精度高い）
  const mLine = text.match(/当選発表日[:：]?\s*([^\s].*?)(?:\s|$)/);
  const candidate = mLine ? mLine[1] : text;

  // 2) 日本語日付（YYYY年MM月DD日）
  let m = candidate.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const Y = parseInt(m[1], 10), M = parseInt(m[2], 10), D = parseInt(m[3], 10);
    if (isValidYMD_(Y, M, D)) return new Date(Y, M - 1, D);
  }

  // 3) スラッシュ or ハイフン（YYYY/MM/DD or YYYY-MM-DD）
  m = candidate.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) {
    const Y = parseInt(m[1], 10), M = parseInt(m[2], 10), D = parseInt(m[3], 10);
    if (isValidYMD_(Y, M, D)) return new Date(Y, M - 1, D);
  }

  // 4) 文章全体からも探索（保険）
  m = text.match(/当選発表日[:：]?\s*(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) {
    const Y = parseInt(m[1], 10), M = parseInt(m[2], 10), D = parseInt(m[3], 10);
    if (isValidYMD_(Y, M, D)) return new Date(Y, M - 1, D);
  }
  m = text.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s*(?:以降|ごろ|頃|ご確認|に)/);
  if (m) {
    const Y = parseInt(m[1], 10), M = parseInt(m[2], 10), D = parseInt(m[3], 10);
    if (isValidYMD_(Y, M, D)) return new Date(Y, M - 1, D);
  }

  return null;
}

/** 全角英数字・記号の主要なものを半角へ */
function toHalfWidth_(s) {
  return String(s).replace(/[！-～]/g, ch => {
    return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
  }).replace(/　/g, ' '); // 全角スペース→半角
}

/** 日付妥当性チェック（単純） */
function isValidYMD_(Y, M, D) {
  if (!Y || !M || !D) return false;
  if (M < 1 || M > 12) return false;
  if (D < 1 || D > 31) return false;
  const dt = new Date(Y, M - 1, D);
  return dt.getFullYear() === Y && (dt.getMonth() + 1) === M && dt.getDate() === D;
}



// function doGet(e) {
//   Logger.log(e.parameter);
//   const eventId = e?.parameter?.eventId;
//   if (eventId) {
//     markEventAsDone_(eventId); // 👈 対象イベントのみ完了処理
//   }

//   const tpl = HtmlService.createTemplateFromFile('complete');
//   tpl.doneAt = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
//   return tpl.evaluate()
//             .setTitle('完了しました')
//             .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
// }

// /**
//  * 特定のイベントIDを「完了」に変更する
//  */
// function markEventAsDone_(eventId) {
//   const DONE = '【申し込み完了】';
//   const TARGET = '国産洋酒の抽選販売実施について';

//   const now = new Date();
//   const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

//   const events = CalendarApp.getDefaultCalendar().getEvents(start, end);

//   // イベントIDを正規化（@より前の部分だけ比較）
//   const normalizedId = eventId.split('@')[0];

//   // 部分一致で検索
//   const targetEvent = events.find(ev => ev.getId().split('@')[0] === normalizedId);

//   if (targetEvent) {
//     const title = targetEvent.getTitle();
//     if (title.includes(TARGET) && !title.startsWith(DONE)) {
//       targetEvent.setTitle(DONE + title);
//       Logger.log(`✅ イベント更新: ${title}`);
//     } else {
//       Logger.log(`⚠️ すでに完了済み、または対象外: ${title}`);
//     }
//   } else {
//     Logger.log(`❌ 該当イベントが見つかりません (eventId=${eventId})`);
//   }
// }