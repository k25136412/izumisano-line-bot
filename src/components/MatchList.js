import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import { collection, getDocs, writeBatch, doc, query, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import html2canvas from 'html2canvas';

const MatchList = () => {
  const [analyzing, setAnalyzing] = useState(false);
  const [matches, setMatches] = useState([]);

  // --- 1. 保存済みデータの読み込み (編集機能) ---
  const fetchSavedMatches = async () => {
    const q = query(collection(db, "games"), orderBy("gameDate", "asc"));
    const querySnapshot = await getDocs(q);

    const savedData = querySnapshot.docs.map(doc => {
      const data = doc.data();

      // FirestoreのTimestampを取得
      const d = data.sendScheduledAt.toDate();

      // 💡 日本時間のまま YYYY-MM-DDTHH:mm 形式に組み立てる
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');

      const formattedSendAt = `${year}-${month}-${day}T${hours}:${minutes}`;

      return { ...data, sendScheduledAt: formattedSendAt };
    });

    setMatches(savedData);
  };

  useEffect(() => {
    fetchSavedMatches();
  }, []);

  // 1週間前の朝10時を計算する共通ロジック
  const calculateSendDate = (dateStr) => {
    if (!dateStr) return "";
    const gameDate = new Date(dateStr);
    const sendDate = new Date(gameDate);
    sendDate.setDate(sendDate.getDate() - 7);
    const y = sendDate.getFullYear();
    const m = String(sendDate.getMonth() + 1).padStart(2, '0');
    const d = String(sendDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}T10:00`;
  };

  // --- 2. 各行への「挿入」機能 ---
  const insertMatch = (index) => {
    const newMatch = {
      gameDate: "",
      opponent: "",
      timeSlotId: "slot_1",
      refereeType: "none",
      sendScheduledAt: "",
      isSent: false
    };
    const updated = [...matches];
    updated.splice(index, 0, newMatch); // 指定した位置に挿入
    setMatches(updated);
  };

  // AI解析処理
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setAnalyzing(true);
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1];
        const functions = getFunctions(undefined, 'asia-northeast2');
        const analyzeFunc = httpsCallable(functions, 'analyzeSchedule');
        const result = await analyzeFunc({ imageBase64: base64 });

        const aiResults = result.data.map((item) => ({
          gameDate: item.gameDate,
          opponent: item.opponent,
          timeSlotId: `slot_${item.timeSlotNo}`,
          refereeType: item.refereeType || "none",
          sendScheduledAt: calculateSendDate(item.gameDate),
          isSent: false
        }));

        setMatches([...matches, ...aiResults]); // 既存リストの末尾に追加
        alert(`${aiResults.length} 件の情報を追加しました。`);
      } catch (err) {
        alert("解析に失敗しました。");
      } finally {
        setAnalyzing(false);
      }
    };
  };

  // --- 画像としてダウンロードする処理 ---
  const exportAsImage = async () => {
    const targetElement = document.getElementById('schedule-export-area');
    if (!targetElement) return;

    try {
      // 背景を白にしてHTML要素をCanvas（画像データ）に変換
      const canvas = await html2canvas(targetElement, { backgroundColor: '#ffffff', scale: 2 });
      const imgData = canvas.toDataURL('image/png');

      // 仮想のリンクを作ってダウンロードを発火
      const downloadLink = document.createElement('a');
      downloadLink.href = imgData;
      downloadLink.download = 'izumisano_schedule.png'; // 保存されるファイル名
      downloadLink.click();
    } catch (err) {
      console.error(err);
      alert("画像の生成に失敗しました。");
    }
  };

  // 日付を「YYYY/M/D」形式に変換する関数
  const formatDate = (dateString) => {
    if (!dateString) return "未定";
    const [year, month, day] = dateString.split('-');
    return `${year}/${parseInt(month, 10)}/${parseInt(day, 10)}`;
  };

  // 時間割IDから「開始時刻～終了時刻（+2時間）」を取得する関数
  const getTimeRange = (slotId) => {
    switch (slotId) {
      case 'slot_1': return '7:30～9:30';
      case 'slot_2': return '8:35～10:35';
      case 'slot_3': return '9:40～11:40';
      case 'slot_4': return '10:45～12:45';
      case 'slot_5': return '11:50～13:50';
      default: return '未定～未定';
    }
  };

  // --- 3. 洗い替え保存 (Scrap and Build) ---
  const handleBulkSave = async () => {
    if (!window.confirm("現在のリストでデータベースを完全に書き換えます。よろしいですか？")) return;

    const batch = writeBatch(db);
    try {
      // a. 既存のドキュメントをすべて取得して削除
      const existingDocs = await getDocs(collection(db, "games"));
      existingDocs.forEach((d) => {
        batch.delete(d.ref);
      });

      // b. 現在の画面上のリストをすべて新規追加
      matches.forEach((m) => {
        const newDocRef = doc(collection(db, "games"));
        batch.set(newDocRef, {
          ...m,
          sendScheduledAt: new Date(m.sendScheduledAt),
          createdAt: new Date()
        });
      });

      await batch.commit();
      alert("全件を最新状態で保存しました。");
      fetchSavedMatches(); // 再読み込み
    } catch (e) {
      console.error(e);
      alert("保存中にエラーが発生しました。");
    }
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...matches];

    // 1. まず値を更新（手入力された値をセット）
    updated[index][field] = value;

    // 2. 「試合日」が変更された時だけ連動させる
    if (field === 'gameDate') {
      // 💡 送信予定日時がまだ空、もしくは自動計算させたい場合のみ上書き
      // 手入力がある場合は上書きしない、というガード節を設けます
      if (!updated[index].sendScheduledAt) {
        updated[index].sendScheduledAt = calculateSendDate(value);
      }
    }

    setMatches(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '100px' }}>
      <h2>📅 試合日程の管理</h2>

      <div style={uploadCard}>
        <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>
          {analyzing ? "⌛ AI解析中..." : "✨ 日程表をアップロードして追加"}
        </label>
        <input type="file" accept="image/*" onChange={handleFileUpload} disabled={analyzing} />
      </div>

      <button onClick={() => insertMatch(0)} style={insertBtn}>＋ 先頭に試合を手動追加</button>

      {matches.map((m, index) => (
        <React.Fragment key={index}>
          <div style={{ ...itemCard, borderLeft: m.isSent ? '10px solid #ccc' : '10px solid #28a745' }}>
            {m.isSent && <span style={sentBadge}>送信済み</span>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontWeight: 'bold' }}>#{index + 1}</span>
              <button onClick={() => setMatches(matches.filter((_, i) => i !== index))} style={delBtn}>削除</button>
            </div>

            <div style={formGrid}>
              <div style={inputGroup}><label>試合日</label>
                <input type="date" value={m.gameDate} onChange={(e) => handleInputChange(index, 'gameDate', e.target.value)} />
              </div>
              <div style={inputGroup}><label>相手</label>
                <input type="text" value={m.opponent} onChange={(e) => handleInputChange(index, 'opponent', e.target.value)} />
              </div>
              <div style={inputGroup}><label>時間割</label>
                <select value={m.timeSlotId} onChange={(e) => handleInputChange(index, 'timeSlotId', e.target.value)}>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={`slot_${n}`}>{n}番</option>)}
                </select>
              </div>
              <div style={inputGroup}><label>審判</label>
                <select value={m.refereeType} onChange={(e) => handleInputChange(index, 'refereeType', e.target.value)}>
                  <option value="none">なし</option><option value="before">前審判</option><option value="after">後審判</option>
                </select>
              </div>
              <div style={{ ...inputGroup, gridColumn: 'span 2' }}>
                <label>LINE送信予定日時</label>
                <input type="datetime-local" value={m.sendScheduledAt} onChange={(e) => handleInputChange(index, 'sendScheduledAt', e.target.value)} />
              </div>
            </div>
          </div>
          <button onClick={() => insertMatch(index + 1)} style={insertBtn}>＋ ここに挿入</button>
        </React.Fragment>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>📸 TimeTree連携用 画像出力</h3>
        {/* 👇 ここで exportAsImage を呼んでいます */}
        <button onClick={exportAsImage} style={exportBtn}>
          スケジュールを画像としてダウンロード
        </button>
      </div>
      {/* 実際に画像化される部分（このdivの中身がそのまま画像になります） */}
      <div id="schedule-export-area" style={exportAreaStyle}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={thStyle}>日時</th>
              <th style={thStyle}>予定内容</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ddd' }}>
                <td style={tdStyle}>
                  {formatDate(m.gameDate)} {getTimeRange(m.timeSlotId)}
                </td>
                <td style={tdStyle}>
                  サッカー試合 泉佐野(VS{m.opponent || '未定'})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={footerBar}>
        <button onClick={handleBulkSave} style={saveBtn}>
          データベースをこの内容で洗い替え保存
        </button>
      </div>
    </div>
  );
};

// スタイル
const uploadCard = { border: '2px dashed #007bff', padding: '15px', borderRadius: '10px', backgroundColor: '#e3f2fd', textAlign: 'center' };
const itemCard = { border: '1px solid #ddd', padding: '15px', borderRadius: '10px', backgroundColor: '#fff', position: 'relative' };
const formGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' };
const inputGroup = { display: 'flex', flexDirection: 'column', fontSize: '0.8rem' };
const saveBtn = { width: '100%', padding: '15px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' };
const insertBtn = { padding: '5px', backgroundColor: '#f8f9fa', border: '1px dashed #bbb', cursor: 'pointer', fontSize: '0.8rem' };
const delBtn = { backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px' };
const sentBadge = { position: 'absolute', top: '-10px', right: '50px', backgroundColor: '#ccc', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem' };
const footerBar = { position: 'fixed', bottom: 0, left: 0, right: 0, padding: '15px', background: 'rgba(255,255,255,0.9)', borderTop: '1px solid #ddd', zIndex: 1000 };
const exportBtn = { padding: '10px 20px', backgroundColor: '#17a2b8', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' };
const exportAreaStyle = { padding: '30px', backgroundColor: '#fff', width: '100%', maxWidth: '600px', margin: '20px auto', boxShadow: '0 4px 8px rgba(0,0,0,0.1)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff', border: '1px solid #ddd' };
const thStyle = { padding: '10px', border: '1px solid #ddd', textAlign: 'left', color: '#333', fontWeight: 'bold' };
const tdStyle = { padding: '10px', border: '1px solid #ddd', color: '#333', fontSize: '1.1rem' };

export default MatchList;