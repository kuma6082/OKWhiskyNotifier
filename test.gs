function test(){
var eventDetails = {
  title: 'OKストア:ウイスキー抽選',
  captions: [
    'アサヒビール竹鶴ピュアモルト　瓶700ml（外箱無し）7,000円（税込7,700円）',
    'アサヒビールニッカ シングルモルト余市 10年 45° 700ml\t（外箱無し）8,000円（税込8,800円）',
    'アサヒビールニッカ　フロムザバレル　500ml（外箱無し）3,200円（税込3,520円）'
  ],
  applicationPeriod: '2025年1月23日(木)～1月25日(土)',
  announcementDate: '2025年2月5日(水)',
  paymentPeriod: '2025年2月13日(木)～2月15日(土)'
};

// Discord通知
// notifyDiscord(eventDetails);

// Googleカレンダー登録
addToGoogleCalendar(eventDetails);
}
