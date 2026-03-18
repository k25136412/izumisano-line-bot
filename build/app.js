// Firebaseのライブラリをインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// TODO: ここをFirebaseコンソールで取得した値に書き換えてください
const firebaseConfig = {
apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: "izumisano-line-bot.firebasestorage.app",
  messagingSenderId: "966920664174",
  appId: "1:966920664174:web:4f48ce2f76648f3f9d627f"
};

// FirebaseとFirestoreの初期化（DB接続）
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- プレビュー処理 ---
function showPreview() {
    const gameDate = document.getElementById('gameDate').value;
    const opponent = document.getElementById('opponent').value;
    const timeSlot = parseInt(document.getElementById('timeSlot').value);
    const refereeBefore = document.getElementById('refereeBefore').checked;

    let meetTime = timeSlot === 2 ? "7:15集合" : (timeSlot === 3 ? "8:20集合" : "未定");
    let kickoffTime = timeSlot === 2 ? "8:35キックオフ" : (timeSlot === 3 ? "9:40キックオフ" : "未定");
    let refereeText = refereeBefore ? "※試合前審判があります。早めの集合をお願いします。\n" : "";

    const message = `${gameDate}\nいずみスポーツビレッジ\n${refereeText}${meetTime}\n${kickoffTime}\n対 ${opponent}\n\n試合の出欠、木曜日までに書き込みお願いします。\n\n参加\n\n不参加\n\n未定\n\n審判`;
    
    document.getElementById('previewArea').value = message;
}

// --- データベースへの保存処理 (Insert) ---
async function saveData() {
    const gameDate = document.getElementById('gameDate').value;
    const opponent = document.getElementById('opponent').value;
    const timeSlot = parseInt(document.getElementById('timeSlot').value);
    const refereeBefore = document.getElementById('refereeBefore').checked;
    const refereeAfter = document.getElementById('refereeAfter').checked;
    const sendDateInput = document.getElementById('sendDate').value;

    if (!sendDateInput) {
        alert("送信予定日時を入力してください！");
        return;
    }

    // 保存するデータの形（C#のモデルクラスのインスタンス化に相当）
    const scheduleData = {
        gameDate: gameDate,
        opponent: opponent,
        timeSlot: timeSlot,
        hasRefereeBefore: refereeBefore,
        hasRefereeAfter: refereeAfter,
        sendScheduledAt: new Date(sendDateInput), // 日付型に変換して保存
        isSent: false // 最初は未送信なのでfalse
    };

    try {
        // 'games' というコレクション（テーブル）にデータを追加
        const docRef = await addDoc(collection(db, "games"), scheduleData);
        alert(`保存に成功しました！ (ID: ${docRef.id})`);
    } catch (e) {
        console.error("エラーが発生しました: ", e);
        alert("保存に失敗しました。コンソールを確認してください。");
    }
}

// ボタンにイベントを紐付け
document.getElementById('previewBtn').addEventListener('click', showPreview);
document.getElementById('saveBtn').addEventListener('click', saveData);