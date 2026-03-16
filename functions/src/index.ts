import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { GoogleGenerativeAI } from "@google/generative-ai";

admin.initializeApp();

// --- 10分おきの自動送信処理 ---
export const sendLineReminders = onSchedule({
  schedule: "every 10 minutes",
  region: "asia-northeast2",
  timeZone: "Asia/Tokyo",
}, async (event) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // 1. 送信対象の試合を取得
  const snapshot = await db.collection("games")
    .where("isSent", "==", false)
    .where("sendScheduledAt", "<=", now)
    .get();

  if (snapshot.empty) return;

  // 2. マスタデータ（ひな型・時間割）を一括取得 (C#のキャッシュ戦略と同じ)
  const templateSnap = await db.doc("masters/templates").get();
  const templates = templateSnap.data();
  const slotsSnap = await db.collection("timeSlots").get();
  const slots: any = {};
  slotsSnap.forEach(s => slots[s.id] = s.data());

  if (!templates) {
    console.error("ひな型マスタが見つかりません。");
    return;
  }

const LINE_TOKEN = process.env.LINE_TOKEN;
const GROUP_ID = process.env.GROUP_ID;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const slot = slots[data.timeSlotId]; // マスタから時間割を取得
    
    if (!slot) continue;

    // 曜日の計算
    const dayOfWeek = ["日", "月", "火", "水", "木", "金", "土"][new Date(data.gameDate).getDay()];

    // 適切なひな型を選択
    let templateText = "";
    if (data.refereeType === "before") templateText = templates.before_ref;
    else if (data.refereeType === "after") templateText = templates.after_ref;
    else templateText = templates.no_ref;

    // 変数の置換 (C#の String.Replace 相当)
    const messageText = templateText
      .replace(/{試合日}/g, data.gameDate.split("-")[1] + "月" + data.gameDate.split("-")[2] + "日")
      .replace(/{曜日}/g, `${dayOfWeek}曜日`)
      .replace(/{場所}/g, "いずみスポーツビレッジ")
      .replace(/{集合}/g, slot.meetingTime)
      .replace(/{キックオフ}/g, slot.kickoffTime)
      .replace(/{対戦相手}/g, data.opponent)
      .replace(/{締切曜日}/g, "木曜日")
      .replace(/{審判集合}/g, slot.preRefereeTime || "");

    // LINE送信処理
    try {
      const response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LINE_TOKEN}`,
        },
        body: JSON.stringify({
          to: GROUP_ID,
          messages: [{ type: "text", text: messageText }],
        }),
      });

      if (response.ok) {
        await doc.ref.update({ isSent: true });
        console.log(`送信完了: ${data.opponent}`);
      }
    } catch (error) {
      console.error("送信エラー:", error);
    }
  }
});

// --- AI解析処理 ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const analyzeSchedule = onCall({ region: "asia-northeast2" }, async (request) => {

// 環境変数のチェック（デバッグ用）
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY が環境変数に設定されていません。");
    throw new HttpsError("failed-precondition", "API Key is missing");
  }

  // APIキーの先頭4文字だけログに出して確認（本物は出さない）
  console.log(`Using API Key starting with: ${apiKey.substring(0, 4)}...`);
  
    const { imageBase64 } = request.data;
const model = genAI.getGenerativeModel(
    { model: "gemini-2.5-flash" },
    { apiVersion: "v1" } // ← ここを明示的に追加
  );
  
//   const prompt_old = `
//     泉佐野というサッカーチームに所属しています。
//     この日程表の画像は今年度の月日ごとに1つの表になっていて、その日の対戦カードと審判担当チーム（一番右の列）を表しています。
//     1列目は時間割の番号です、2列目～4列目は対戦カードです。5列目は審判担当チームです。
//     泉佐野の直近の試合情報を抽出して以下のJSON形式で返してください。
//     - gameDate: "YYYY-MM-DD"形式
//     - opponent: 対戦相手名
//     - timeSlotNo: 開始時間から判断して 1〜5 の番号（7:30=1, 8:35=2, 9:40=3, 10:45=4, 11:50=5）
//     - refereeType: "before"（前審判あり）, "after"（後審判あり）, "none"（なし）
//     必ず純粋なJSON配列 [ { ... } ] のみを返してください。
//   `;
const currentYear = new Date().getFullYear();
const prompt = `
    泉佐野というサッカーチームに所属しています。
    この日程表の画像から、泉佐野の全試合情報を抽出してください。

    【重要ルール】
    1. 年の指定：画像に年がない場合、原則「${currentYear}年」としてください。1〜3月の試合は「${currentYear + 1}年」にしてください。
    2. 曜日の整合性：試合はすべて日曜日です。${currentYear}年（および${currentYear+1}年）の中で、その月日が「日曜日」になるよう年を正しく設定してください。
    3. 出力制限：説明文、挨拶、注釈は一切不要です。**必ず [ で始まり ] で終わる純粋なJSON配列のみ**を出力してください。

    【表の構造】
    ・1列目：時間割番号
    ・2〜4列目：対戦カード
    ・5列目（一番右）：審判担当チーム

    【出力形式】
    - gameDate: "YYYY-MM-DD"形式
    - opponent: 対戦相手名
    - timeSlotNo: 1〜5
    - refereeType: "before", "after", "none"
  `;

const result = await model.generateContent([
    prompt,
    { inlineData: { data: imageBase64, mimeType: "image/jpeg" } } // pngからjpeg（一般的）に変更
  ]);

const response = await result.response;
    const text = response.text();
    console.log("AI Response Raw:", text);

    // ✨ 鉄壁のJSON抽出ロジック
    // 文中から最初の [ と 最後の ] の間を抜き出す
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("JSONが見つかりませんでした:", text);
      throw new HttpsError("internal", "AIの回答にJSON形式のデータが含まれていませんでした。");
    }

    const cleanJson = jsonMatch[0];
    return JSON.parse(cleanJson);
});