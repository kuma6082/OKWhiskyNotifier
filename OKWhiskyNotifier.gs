function okWhiskyNotifier() {
  notifyDiscordForCalendarEvents();
  
  var url = "https://ok-corporation.jp/news/";

  var scriptProperties = PropertiesService.getScriptProperties();
  var savedDate = scriptProperties.getProperty("lastSavedDate");

  if (!savedDate) {
    Logger.log("スクリプトプロパティが存在しません。初期化します。");
    scriptProperties.setProperty("lastSavedDate", "1970-01-01");
    savedDate = "1970-01-01";
  }

  var response = UrlFetchApp.fetch(url);
  var html = response.getContentText();

  var ulRegex = /<ul class="headline clearfix"[^>]*>([\s\S]*?)<\/ul>/;
  var ulMatch = ulRegex.exec(html);

  if (ulMatch && ulMatch[1]) {
    var ulContent = ulMatch[1];

    var liRegex = /<li class="headline-item[^>]*">([\s\S]*?)<\/li>/g;
    var liMatches = [...ulContent.matchAll(liRegex)];

    if (liMatches.length === 0) {
      Logger.log("該当するニュースがありません。");
      return;
    }

    var latestDate = savedDate; // 最新の日付を格納する変数

    liMatches.forEach((match) => {
      var extractedContent = match[1];

      if (extractedContent.includes("国産洋酒")) {
        var dateRegex = /<time[^>]*datetime="(\d{4}-\d{2}-\d{2})">/;
        var dateMatch = dateRegex.exec(extractedContent);

        var linkRegex = /<a[^>]*href="([^"]*)"/;
        var linkMatch = linkRegex.exec(extractedContent);

        if (dateMatch && dateMatch[1]) {
          var extractedDate = dateMatch[1];

          if (extractedDate > savedDate) {
            Logger.log("新しい記事を検出: " + extractedDate);

            if (linkMatch && linkMatch[1]) {
              var extractedLink = linkMatch[1];
              processExtractedUrl(extractedLink);
              Logger.log("抽出されたリンク: " + extractedLink);
            } else {
              Logger.log("リンクが抽出できませんでした。");
            }

            // 最新の日付を更新
            if (extractedDate > latestDate) {
              latestDate = extractedDate;
            }
          } else{
            Logger.log("新しい記事ではありませんでした。")
          }
          
        } else {
          Logger.log("日付が抽出できませんでした。");
        }
      } else {
        Logger.log("内容に「国産洋酒」は含まれていません。");
      }
    });

    // すべての処理が終わった後、最新の日付を保存
    if (latestDate > savedDate) {
      scriptProperties.setProperty("lastSavedDate", latestDate);
      Logger.log("スクリプトプロパティを更新しました: " + latestDate);
    }
  } else {
    Logger.log("<ul>タグが見つかりませんでした。");
  }
}


function processExtractedUrl(extractedUrl) {
  // 抽出したURLにアクセスしてデータを取得
  var response = UrlFetchApp.fetch(extractedUrl);
  var html = response.getContentText();

  // 必要な情報を抽出する
  var eventInfo = extractEventDetails(html);

  console.log(eventInfo)

  // Discordに通知
  notifyDiscord(eventInfo);

  // Googleカレンダーに登録
  addToGoogleCalendar(eventInfo);
}

function extractEventDetails(html) {
  // タイトルを抽出し、「（」以降を削除
  var titleRegex = /<h2[^>]*>(.*?)<\/h2>/;
  var titleMatch = titleRegex.exec(html);
  var rawTitle = titleMatch ? titleMatch[1].trim() : "タイトル不明";
  var title = rawTitle.replace(/（.*$/, "").trim(); // 「（」以降を削除

  // クラス "caption" のすべての要素を抽出し、HTMLタグを削除
  var captionRegex = /<p class="caption">([\s\S]*?)<\/p>/g;
  var captionMatches = [...html.matchAll(captionRegex)];
  var captions = captionMatches.map(match => match[1].replace(/<[^>]*>/g, "").trim());

  // お申込み期間の抽出
  var applicationPeriodRegex = /<dt>\s*〈お申込み期間〉\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/;
  var applicationPeriodMatch = applicationPeriodRegex.exec(html);
  var applicationPeriod = applicationPeriodMatch
    ? applicationPeriodMatch[1]
        .split(/\s*\n\s*/)[0] // 改行で分割し、最初の部分だけ取得
        .replace(/<br\s*\/?>/g, " ") // <br> を空白に変換
        .trim() // 余分な空白を削除
    : "お申込み期間情報なし";

  // 当選発表日の抽出
  var announcementDateRegex = /<dt>〈当選発表日〉<\/dt>\s*<dd>(.*?)<\/dd>/;
  var announcementDateMatch = announcementDateRegex.exec(html);
  var announcementDate = announcementDateMatch ? announcementDateMatch[1].trim() : "当選発表日情報なし";

  // お支払い・受け取り期間の抽出
  var paymentPeriodRegex = /<dt>〈お支払い・受け取り期間〉<\/dt>\s*<dd>(.*?)<\/dd>/;
  var paymentPeriodMatch = paymentPeriodRegex.exec(html);
  var paymentPeriod = paymentPeriodMatch ? paymentPeriodMatch[1].trim() : "お支払い・受け取り期間情報なし";

  // 抽出結果を格納するオブジェクト
  var eventDetails = {
    title: title, // ()を除去したタイトル
    captions: captions, // HTMLタグを削除したキャプション
    applicationPeriod: applicationPeriod, // お申込期間
    announcementDate: announcementDate, // 当選発表
    paymentPeriod: paymentPeriod, // お支払い・受け取り期間
  };

  return eventDetails;
}

function notifyDiscord(eventInfo) {
  var scriptProperties = PropertiesService.getScriptProperties();

  // スクリプトプロパティから保存済みの日付を取得
  var webhookUrl = scriptProperties.getProperty("discord");

  var content = `新しいイベント情報が公開されました！🎉\n
**タイトル:** ${eventInfo.title}\n
**説明:**\n${eventInfo.captions.join("\n")}\n
**お申込期間:** ${eventInfo.applicationPeriod}\n
**当選発表日:** ${eventInfo.announcementDate}\n
**お支払い・受け取り期間:** ${eventInfo.paymentPeriod}`;

  var payload = {
    content: content
  };

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  };

  UrlFetchApp.fetch(webhookUrl, options);
  Logger.log("Discordに通知しました。");
}

function addToGoogleCalendar(eventInfo) {
  var calendar = CalendarApp.getDefaultCalendar();

  // applicationPeriod を日付に分割して解析
  var periodRegex = /(\d{4})年(\d{1,2})月(\d{1,2})日.*?～.*?(\d{4})?年?(\d{1,2})月(\d{1,2})日/;
  var periodMatch = periodRegex.exec(eventInfo.applicationPeriod);

  if (periodMatch) {
    var startYear = parseInt(periodMatch[1], 10);
    var startMonth = parseInt(periodMatch[2], 10) - 1; // JavaScriptの月は0始まり
    var startDay = parseInt(periodMatch[3], 10);

    var endYear = periodMatch[4] ? parseInt(periodMatch[4], 10) : startYear; // 年が省略された場合、開始日と同じ年を使用
    var endMonth = parseInt(periodMatch[5], 10) - 1; // JavaScriptの月は0始まり
    var endDay = parseInt(periodMatch[6], 10);

    // Date オブジェクトとして開始日と終了日を作成
    var startDate = new Date(startYear, startMonth, startDay);
    var endDate = new Date(endYear, endMonth, endDay);

    // 終了日を1日後に設定（Googleカレンダーの期間は非包含のため）
    endDate.setDate(endDate.getDate() + 1);

    // Googleカレンダーにイベントを作成
    calendar.createEvent(`OKストア:${eventInfo.title}`, startDate, endDate, {
      description: `説明:\n${eventInfo.captions.join("\n")}\n
お申込期間: ${eventInfo.applicationPeriod}\n
当選発表日: ${eventInfo.announcementDate}\n
お支払い・受け取り期間: ${eventInfo.paymentPeriod}`
    });

    Logger.log("Googleカレンダーに登録しました: " + eventInfo.title);
  } else {
    Logger.log("お申込期間の解析に失敗しました。");
  }
}




