// API v1.1 用コード

//認証用インスタンスの生成
var twitter = TwitterWebService.getInstance(
  'xxxxxxxxxxxxxxxxxxxxxxxxx',//API Key
  'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' //API secret key
);
 
//アプリを連携認証する
function authorize() {
  twitter.authorize();
}
 
//認証を解除する
function reset() {
  twitter.reset();
}
 
//認証後のコールバック
function authCallback(request) {
  return twitter.authCallback(request);
}
//プロジェクトID: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
//CallbackURL: https://script.google.com/macros/d/xxxxxxxxxx/usercallback

// twitterエンドポイントURL
var tw_endpoint_statuses = "https://api.twitter.com/1.1/statuses/update.json";
var tw_enpoint_media = "https://upload.twitter.com/1.1/media/upload.json";

function post_test_tweet() {
  // var service  = twitter.getService(); //TwitterWebServiceのインスタンス
  // var my_message = "テストです";
  //   var response = service.fetch("https://api.twitter.com/1.1/statuses/update.json", {
  //   'method': 'post',
  //   'payload' : { 'status' : my_message }
  // });
  
  let msg = "テスト用ツイート";
  let img_urls = ["https://drive.google.com/uc?export=view&id=1Yhg-4omP4_7JyfdiEHgv6fR2nOnVZbxk"];
  let tw_id = post_tweet(msg, null, img_urls);
}


/// twitterへ投稿する
/// - msg : ツイートに入れるテキスト
/// - re_id : 返信するツイートID (返信でない時はnullにする)
/// - img_urls : 画像のURLの配列
/// 返り値はツイートした投稿のID
function post_tweet(msg, re_id, img_urls){
  var service  = twitter.getService(); //TwitterWebServiceのインスタンス
  
  var img_ids = [];
  
  if(img_urls && img_urls.length > 4){
    // 5枚以上ある時は分割して投稿。最初の投稿の返信(スレッド)になる。文章は同じ。*1
    var img_urls_now = img_urls.splice(0,4);
    var tw_id = post_tweet(msg, re_id, img_urls_now);
    tw_id = post_tweet(msg, tw_id, img_urls);
    return tw_id;
  }else if(img_urls){
    // 画像が4枚以下の場合は順番にエンコード→アップロードする。*2
    for(var i = 0; i < img_urls.length; i++){
      var img_blob = UrlFetchApp.fetch(img_urls[i]).getBlob();
      var img_64 = Utilities.base64Encode(img_blob.getBytes());
      var img_upload = service.fetch(
        tw_enpoint_media, { 
          'method' : "POST", 
          'payload': { 'media_data': img_64 } 
        }
      ); 
      // media_idをimg_idsに格納。
      img_ids[i] = JSON.parse(img_upload).media_id_string;
    }
  }
  
  // ツイート
  var response = service.fetch(tw_endpoint_statuses, {
    method: "post",
    payload: {
      'status' : msg,
      'in_reply_to_status_id' : re_id, //　返信するツイートID
      'media_ids' : img_ids.join(',')  // すでにアップロードした画像のid(カンマ区切りで結合) *3
    }
  });
  
  tw_id = JSON.parse(response).id_str;

  return tw_id;
}


// API v2 用コード

// 以下のCLIENT_ID, CLIENT_SECRETはtwitter APIの管理画面から取得する
const CLIENT_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
const CLIENT_SECRET = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'

/**
 * Create the OAuth2 Twitter Service
 * @return OAuth2 service
 */
function getService_v2() {
  pkceChallengeVerifier();
  const userProps = PropertiesService.getUserProperties();
  const scriptProps = PropertiesService.getScriptProperties();
  return OAuth2.createService('twitter')
    .setAuthorizationBaseUrl('https://twitter.com/i/oauth2/authorize')
    .setTokenUrl('https://api.twitter.com/2/oauth2/token?code_verifier=' + userProps.getProperty("code_verifier"))
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction('authCallback_v2')
    .setPropertyStore(userProps)
    .setScope('users.read tweet.read tweet.write offline.access media.write')
    // .setScope('users.read tweet.read tweet.write offline.access')
    .setParam('response_type', 'code')
    .setParam('code_challenge_method', 'S256')
    .setParam('code_challenge', userProps.getProperty("code_challenge"))
    .setTokenHeaders({
      'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET),
      'Content-Type': 'application/x-www-form-urlencoded'
    })
}

/**
 * Reset the OAuth2 Twitter Service
 */
function reset_v2() {
    getService_v2().reset();
    PropertiesService.getUserProperties().deleteProperty("code_challenge");
    PropertiesService.getUserProperties().deleteProperty("code_verifier");
  }
  
/**
 * Handles the OAuth callback.
 */
function authCallback_v2(request) {
  const service = getService_v2();
  const authorized = service.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success!');
  } else {
    return HtmlService.createHtmlOutput('Denied.');
  }
}

/**
 * Generate PKCE Challenge Verifier for Permission for OAuth2 Twitter Service
 */
function pkceChallengeVerifier() {
  var userProps = PropertiesService.getUserProperties();
  if (!userProps.getProperty("code_verifier")) {
    var verifier = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

    for (var i = 0; i < 128; i++) {
      verifier += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    var sha256Hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, verifier)

    var challenge = Utilities.base64Encode(sha256Hash)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')
    userProps.setProperty("code_verifier", verifier)
    userProps.setProperty("code_challenge", challenge)
  }
}

function logRedirectUri() {
  const service = getService_v2();
  Logger.log(service.getRedirectUri());
}

// 初回のみ実行するコード (認証を実行)
function runWhenFirstTime() {
  const service = getService_v2();
  if (service.hasAccess()) {
    Logger.log("Already authorized");
  } else {
    const authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL and re-run the script: %s', authorizationUrl);
  }
}

function sendTestTweet() {
  let payload = {
    text: 'Test. '
  }

  const service = getService_v2();
  if (service.hasAccess()) {
    let url = `https://api.twitter.com/2/tweets`;
    let response = UrlFetchApp.fetch(url, {
      method: 'POST',
      'contentType': 'application/json',
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken()
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    });
    let result = JSON.parse(response.getContentText());
    Logger.log(JSON.stringify(result, null, 2));
  } else {
    let authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL and re-run the script: %s',authorizationUrl);
  }
}


/// twitterへ投稿する(API v2)
/// - msg : ツイートに入れるテキスト
/// - re_id : 返信するツイートID (返信でない時はnullにする)
/// - img_urls : 画像のURLの配列
/// 返り値はツイートした投稿のID
function post_tweet_v2(msg, re_id, img_urls){
  const service  = getService_v2();
  
  // media_idの取得
  let img_ids = [];
  if (img_urls && img_urls.length > 0) {
    // img_ids = media_upload(img_urls);
    img_ids = media_upload_v2(img_urls);
  }

  // ツイートの本体データ
  let payload = "";
  if (img_ids && img_ids.length >0 ) {
    payload = {
      'text': msg,
      "media":{
          "media_ids": img_ids
      }
    };
  } else {
    payload = {
      'text': msg
    };
  }

  // ツイートの投稿
  let result ="";
  if (service.hasAccess()) {
    const url = `https://api.twitter.com/2/tweets`;
    const response = UrlFetchApp.fetch(url, {
      method: 'POST',
      'contentType': 'application/json',
      headers: {
        Authorization: 'Bearer ' + service.getAccessToken()
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    });
    result = JSON.parse(response.getContentText());
    Logger.log(JSON.stringify(result, null, 2));
  } else {
    const authorizationUrl = service.getAuthorizationUrl();
    Logger.log('Open the following URL and re-run the script: %s',authorizationUrl);
  }

  // tw_id = JSON.parse(response).id_str;
  // return tw_id;
}

// ここだけAPIv1.1で動く(2023.07.19現在)
function media_upload(img_urls) {
  const service  = twitter.getService(); //TwitterWebServiceのインスタンス
  let img_ids = [];

  // 画像がを順番にエンコード→アップロードする
  for(let i = 0; i < img_urls.length; i++){
    let img_blob = UrlFetchApp.fetch(img_urls[i]).getBlob();
    let img_64 = Utilities.base64Encode(img_blob.getBytes());
    let img_upload = service.fetch(
      tw_enpoint_media, { 
        'method' : "POST", 
        'payload': { 'media_data': img_64 } 
      }
    ); 
    // media_idをimg_idsに格納。
    img_ids[i] = JSON.parse(img_upload).media_id_string;
  }
  return img_ids;
}

/// 引用ツイートのテスト
function test_quoted_tweet() {

  const quote_url = "https://twitter.com/tojinogazou/status/1688275921218736128";
  let msg = "引用ツイートのテスト"+ "\n" + quote_url;
  let img_urls = null;

  logging("test_quoted_tweet", "", msg, img_urls); // ログ用シートに書き込み
  let tw_id = post_tweet_v2(msg, null, img_urls);
  // let tw_id = post_tweet(msg, null, img_urls);
}







const SPREADSHEET_ID = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/// とじとも画像をツイート
function post_toji_tweet() {
  // シートの指定．GoogleスプレッドシートのURLの「https://docs.google.com/spreadsheets/d/***************************************/edit#gid=0」の部分を使う．
  let spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  // データシートを取得
  let sheet = spreadsheet.getSheetByName('データシートlatest');

  let firstRow = 3;  // 開始行
  let lastRow = 1022; // 最終行
  // ツイート対象のデータ行を指定
  // let recordRow = Math.floor(Math.random() * (lastRow - firstRow + 1)) + firstRow;
  let recordRow = getRandomNumber(1) + firstRow - 1; // post_toji_tweetではgetRandomNumberのシーケンス1を使用

  let cardCategory = sheet.getRange("B" + recordRow).getValue().toString();
  let characterName = sheet.getRange("D" + recordRow).getValue().toString();
  let imageUrl = sheet.getRange("H" + recordRow).getValue().toString();

  let msg = "とじとも" + cardCategory + "\n" + characterName; //ToDo: twitter APIからは連続して完全に同じ文字列のツイートはできないので日時などを入れて変える必要がある
  let img_urls = [imageUrl];

  const tweetType = "post_toji_tweet";
  try {
    let tw_id = post_tweet_v2(msg, null, img_urls);
    // let tw_id = post_tweet(msg, null, img_urls);
    logging(tweetType, characterName, msg, img_urls); // ログ用シートに書き込み
  }
  catch (e) {
    loggingError(tweetType, e.message);
  }
}

