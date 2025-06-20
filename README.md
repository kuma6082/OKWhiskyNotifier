# OK Whisky Notifier

## 概要

このスクリプトは、OKストアのニュースページから「国産洋酒」に関連するニュースをスクレイピングし、新しい情報を検出した場合に **Discord に通知** し、 **Google カレンダーに登録** するものです。また、カレンダーのイベントを確認し、抽選申し込みのリマインダーを Discord に通知します。

## 主な機能

1. **ニュースページのスクレイピング**

   - `okWhiskyNotifier` が OKストアのニュースページを取得し、特定のニュースを抽出
   - 「国産洋酒」に関連するニュースがある場合、詳細情報を取得

2. **Discord への通知**

   - `notifyDiscord` により、取得した情報を Discord Webhook に送信
   - `notifyDiscordForCalendarEvents` により、カレンダーのイベントをチェックし、当日の抽選申し込み期限を通知
   - リマインダー通知には申し込み完了を記録するためのボタンを含めることができます

3. **Google カレンダーへの登録**

   - `addToGoogleCalendar` により、お申込み期間をカレンダーにイベントとして登録
   - 申し込みの期限が近づくと `notifyDiscordForCalendarEvents` でリマインダー通知

## 必要な設定

### **1. スクリプトプロパティの設定**

Google Apps Script の **スクリプトプロパティ** に以下の値を追加してください。

 - `discord` ：Discord の Webhook URL
 - `webapp` ：このリポジトリの `okWhiskyWebApp.gs` をデプロイした Web アプリの URL

※ `webapp` はカレンダーのリマインダー通知に表示される「申し込み完了」ボタンからアクセスされます。

※ `lastSavedDate` はスクリプト実行時に自動的に作成されるため、事前設定は不要です。

### **2. Google カレンダーの設定**

本スクリプトは `CalendarApp.getDefaultCalendar()` を使用するため、Google カレンダーのデフォルトカレンダーが利用されます。

## スクリプトの詳細

### `okWhiskyNotifier()`

- OKストアのニュースページから **「国産洋酒」関連のニュースを取得**
- 既存の取得履歴 (`lastSavedDate`) より新しいものがあれば処理
- 記事の詳細ページを取得し、 `processExtractedUrl()` に渡す

### `processExtractedUrl(extractedUrl)`

- 記事の詳細ページを解析し、 `extractEventDetails()` で必要な情報を抽出
- Discord に通知 (`notifyDiscord()`)
- Google カレンダーに登録 (`addToGoogleCalendar()`)

### `extractEventDetails(html)`

- 記事のタイトル、説明文、お申込み期間、当選発表日、お支払い・受け取り期間を抽出

### `notifyDiscord(eventInfo)`

- Discord Webhook を使用して、新しいイベント情報を通知

### `addToGoogleCalendar(eventInfo)`

- お申込み期間の開始日・終了日を解析し、Google カレンダーにイベントを作成

### `notifyDiscordForCalendarEvents()`

- 当日の Google カレンダーの予定をチェック
- 申し込み期限のイベントがある場合、Discord にリマインダーを送信

### `sendToDiscord(content)`

- 指定されたメッセージを Discord Webhook に送信

## 実行方法

### 1. 手動実行

Google Apps Script エディタ上で `okWhiskyNotifier()` を実行

### 2. 定期実行（トリガー設定）

1. Google Apps Script の **エディター** を開く
2. **トリガーを追加**
   - `okWhiskyNotifier` を **1日1回実行** するよう設定
   - `notifyDiscordForCalendarEvents` を **毎朝実行** するよう設定

## 注意点

- スクレイピング対象のサイトの構造が変更されると動作しなくなる可能性があります。
- Discord Webhook の URL は **外部に漏れないように管理してください**。
- Google カレンダーのデフォルトカレンダーにイベントが登録されるため、必要に応じて変更してください。

## ライセンス

MIT License

