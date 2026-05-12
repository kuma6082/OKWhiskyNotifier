const DISCORD_NOTIFY_DONE_PREFIX = 'discord_notify_done_';
const DISCORD_BLOCKED_UNTIL_KEY = 'discord_blocked_until';
const DISCORD_DEFAULT_BLOCK_MS = 30 * 60 * 1000;

function notifyDiscordForCalendarEvents() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    Logger.log('別の通知処理が実行中のためスキップしました。');
    return;
  }

  try {
    const scriptProperties = PropertiesService.getScriptProperties();

    const blockedUntil = Number(scriptProperties.getProperty(DISCORD_BLOCKED_UNTIL_KEY) || 0);
    if (Date.now() < blockedUntil) {
      Logger.log('Discordが一時制限中のため通知をスキップしました。');
      return;
    }

    const targetKeyword = '国産洋酒の抽選販売実施について';
    const donePrefix = '【処理済み】';
    const timeZone = 'Asia/Tokyo';

    const today = new Date();
    const todayKey = Utilities.formatDate(today, timeZone, 'yyyy-MM-dd');
    const notifiedKey = DISCORD_NOTIFY_DONE_PREFIX + todayKey;
    const notifiedIds = JSON.parse(scriptProperties.getProperty(notifiedKey) || '[]');
    const notifiedSet = new Set(notifiedIds);

    cleanupOldDiscordNotifyKeys_(scriptProperties, todayKey);

    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const calendar = CalendarApp.getDefaultCalendar();
    const events = calendar.getEvents(startOfDay, endOfDay);

    for (const event of events) {
      const title = event.getTitle();

      if (!title.includes(targetKeyword)) continue;
      if (title.startsWith(donePrefix)) continue;

      const eventId = event.getId();
      const normalizedEventId = normalizeCalendarEventId_(eventId);

      if (notifiedSet.has(normalizedEventId)) {
        Logger.log('本日は通知済みのためスキップ: ' + title);
        continue;
      }

      const message = `📅 **${title}**\n本日抽選申し込み期間です。申し込みしてください。`;
      const result = sendToDiscord(message, eventId);

      if (result.ok) {
        notifiedIds.push(normalizedEventId);
        notifiedSet.add(normalizedEventId);
        scriptProperties.setProperty(notifiedKey, JSON.stringify(notifiedIds));
        Logger.log('Discord通知済みに記録しました: ' + title);
        Utilities.sleep(3000);
      } else {
        Logger.log('Discord通知に失敗したため、この後の通知を停止します。 code=' + result.code);
        break;
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function sendToDiscord(content, eventId) {
  let webhookUrl = getDiscordWebhookUrl_();
  const appUrl = getScriptProperty_(['webapp', 'WEBAPP_URL']);

  if (!webhookUrl) {
    Logger.log('Script Properties に discord または DISCORD_WEBHOOK_URL が設定されていません。');
    return { ok: false, code: 'NO_DISCORD_WEBHOOK' };
  }

  if (!appUrl) {
    Logger.log('Script Properties に webapp または WEBAPP_URL が設定されていません。');
    return { ok: false, code: 'NO_WEBAPP_URL' };
  }

  webhookUrl += (webhookUrl.includes('?') ? '&' : '?') + 'with_components=true';

  const payload = {
    content: content,
    components: [{
      type: 1,
      components: [{
        type: 2,
        style: 5,
        label: '🔕 申し込み完了',
        url: `${appUrl}?eventId=${encodeURIComponent(eventId)}`
      }]
    }]
  };

  return postDiscordWebhook_(webhookUrl, payload);
}

function postDiscordWebhook_(webhookUrl, payload) {
  if (!webhookUrl) {
    Logger.log('Discord Webhook URL が未設定です。');
    return { ok: false, code: 'NO_DISCORD_WEBHOOK' };
  }

  const response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code >= 200 && code < 300) {
    return { ok: true, code: code };
  }

  if (code === 429) {
    const retryAfterMs = getRetryAfterMs_(response, body);

    PropertiesService.getScriptProperties().setProperty(
      DISCORD_BLOCKED_UNTIL_KEY,
      String(Date.now() + retryAfterMs)
    );

    Logger.log('Discordレート制限。しばらく通知を停止します。 code=429 body=' + body);
    return { ok: false, code: 429, body: body };
  }

  Logger.log('Discord通知失敗 code=' + code + ' body=' + body);
  return { ok: false, code: code, body: body };
}

function getRetryAfterMs_(response, body) {
  let retryAfterSec = 0;

  try {
    const json = JSON.parse(body);
    retryAfterSec = Number(json.retry_after || 0);
  } catch (e) {
    // Cloudflare 1015 はJSONではなく、テキストまたはHTMLで返る場合がある。
  }

  const headers = response.getAllHeaders();
  const retryAfterHeader = headers['Retry-After'] || headers['retry-after'];
  if (retryAfterHeader) {
    retryAfterSec = Number(retryAfterHeader);
  }

  if (!retryAfterSec || retryAfterSec <= 0) {
    return DISCORD_DEFAULT_BLOCK_MS;
  }

  return Math.ceil(retryAfterSec * 1000);
}

function getDiscordWebhookUrl_() {
  return getScriptProperty_(['discord', 'DISCORD_WEBHOOK_URL']);
}

function getScriptProperty_(keys) {
  const scriptProperties = PropertiesService.getScriptProperties();

  for (const key of keys) {
    const value = scriptProperties.getProperty(key);
    if (value) return value;
  }

  return '';
}

function normalizeCalendarEventId_(eventId) {
  return String(eventId || '').split('@')[0];
}

function cleanupOldDiscordNotifyKeys_(scriptProperties, todayKey) {
  const properties = scriptProperties.getProperties();

  Object.keys(properties).forEach(key => {
    if (
      key.startsWith(DISCORD_NOTIFY_DONE_PREFIX) &&
      key !== DISCORD_NOTIFY_DONE_PREFIX + todayKey
    ) {
      scriptProperties.deleteProperty(key);
    }
  });
}
