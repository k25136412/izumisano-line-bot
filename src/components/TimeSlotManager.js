import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config'; 
import { 
  collection, getDocs, doc, setDoc, query, orderBy, writeBatch 
} from 'firebase/firestore';

const TimeSlotManager = () => {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // Firestoreからマスタを読み込む
  const fetchSlots = async () => {
    const q = query(collection(db, "timeSlots"), orderBy("no", "asc"));
    const querySnapshot = await getDocs(q);
    const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setSlots(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, []);

  // --- 初期データ投入ロジック (関数をコンポーネント内に移動) ---
  const initializeMasterData = async () => {
    if (!window.confirm("マスタデータを初期状態にリセットしますか？")) return;

    const batch = writeBatch(db);

    // 1. 時間割マスタの初期データ (No.1〜5)
    const timeSlots = [
      { no: 1, kickoffTime: "07:30", meetingTime: "07:15", preRefereeTime: "" },
      { no: 2, kickoffTime: "08:35", meetingTime: "08:20", preRefereeTime: "07:15" },
      { no: 3, kickoffTime: "09:40", meetingTime: "09:25", preRefereeTime: "08:20" },
      { no: 4, kickoffTime: "10:45", meetingTime: "10:30", preRefereeTime: "09:25" },
      { no: 5, kickoffTime: "11:50", meetingTime: "11:35", preRefereeTime: "10:30" },
    ];

    timeSlots.forEach(slot => {
      const ref = doc(db, "timeSlots", `slot_${slot.no}`);
      batch.set(ref, slot);
    });

    // 2. ひな型マスタの初期データ
    const templatesRef = doc(db, "masters", "templates");
    const templateData = {
      no_ref: `{試合日}　{曜日}\n{場所}\n\n{集合}集合\n{キックオフ}キックオフ\n対 {対戦相手}\n\n試合の出欠、{締切曜日}までに書き込みお願いします。\n\n参加\n\n不参加\n\n未定`,
      before_ref: `{試合日}　{曜日}\n{場所}\n審判は{審判集合}集合\n{集合}集合\n{キックオフ}キックオフ\n対 {対戦相手}\n\n試合の出欠、{締切曜日}までに書き込みお願いします。\n\n参加\n\n不参加\n\n未定\n\n審判`,
      after_ref: `{試合日}　{曜日}\n{場所}\n試合後審判\n{集合}集合\n{キックオフ}キックオフ\n対 {対戦相手}\n\n試合の出欠、{締切曜日}までに書き込みお願いします。\n\n参加\n\n不参加\n\n未定\n\n審判`
    };
    batch.set(templatesRef, templateData);

    try {
      await batch.commit();
      alert("初期データの投入が完了しました！");
      fetchSlots(); // 画面を更新
    } catch (e) {
      console.error("エラー:", e);
      alert("初期データの投入に失敗しました。");
    }
  };

  // 保存処理
  const handleSave = async (slot) => {
    await setDoc(doc(db, "timeSlots", `slot_${slot.no}`), slot);
    alert(`No.${slot.no} を保存しました`);
    fetchSlots();
  };

  if (loading) return <div>読み込み中...</div>;

  return (
    <div style={{ padding: '20px' }}>
      {/* --- 追加: 初期化ボタン --- */}
      <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '5px' }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>⚠️ 初期設定</p>
        <button onClick={initializeMasterData} style={{ padding: '10px 20px', backgroundColor: '#ffc107', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
          時間割とひな型を初期化する
        </button>
      </div>

      <h2>⏰ 時間割マスタ管理</h2>
      <p>試合開始時間を入力すると、各集合時間が自動計算の基礎になります。</p>
      
      <div style={{ overflowX: 'auto' }}> {/* スマホ用横スクロール対応 */}
        <table border="1" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th>No</th>
              <th>キックオフ</th>
              <th>集合</th>
              <th>前審判集合</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot, index) => (
              <tr key={slot.id}>
                <td>{slot.no}</td>
                <td>
                  <input 
                    type="time" 
                    value={slot.kickoffTime} 
                    onChange={(e) => {
                      const newSlots = [...slots];
                      newSlots[index].kickoffTime = e.target.value;
                      setSlots(newSlots);
                    }}
                  />
                </td>
                <td>{slot.meetingTime}</td>
                <td>{slot.preRefereeTime || '-'}</td>
                <td>
                  <button onClick={() => handleSave(slot)}>保存</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '20px' }}>
        <button onClick={() => {
          const nextNo = slots.length + 1;
          setSlots([...slots, { no: nextNo, kickoffTime: "08:00", meetingTime: "07:45", preRefereeTime: "" }]);
        }}>＋ 行を追加</button>
      </div>
    </div>
  );
};

export default TimeSlotManager;