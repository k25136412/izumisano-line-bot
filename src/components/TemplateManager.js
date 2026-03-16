import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const TemplateManager = () => {
  const [templates, setTemplates] = useState({
    no_ref: "",
    before_ref: "",
    after_ref: ""
  });
  const [loading, setLoading] = useState(true);

  // Firestoreからひな型を読み込む
  useEffect(() => {
    const fetchTemplates = async () => {
      const docRef = doc(db, "masters", "templates");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setTemplates(docSnap.data());
      }
      setLoading(false);
    };
    fetchTemplates();
  }, []);

  const handleSave = async () => {
    await setDoc(doc(db, "masters", "templates"), templates);
    alert("ひな型を保存しました！");
  };

  if (loading) return <div>読み込み中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>📝 送信メッセージひな型設定</h2>
      <p style={{ fontSize: '0.8rem', color: '#666' }}>
        変数は以下の形式で記述してください：<br />
        <code>{`{試合日} {曜日} {集合} {キックオフ} {対戦相手}`}</code>
      </p>

      <div>
        <label><b>1. 審判なし</b></label>
        <textarea 
          style={textAreaStyle} 
          value={templates.no_ref} 
          onChange={(e) => setTemplates({...templates, no_ref: e.target.value})}
        />
      </div>

      <div>
        <label><b>2. 試合前審判あり</b></label>
        <textarea 
          style={textAreaStyle} 
          value={templates.before_ref} 
          onChange={(e) => setTemplates({...templates, before_ref: e.target.value})}
        />
      </div>

      <div>
        <label><b>3. 試合後審判あり</b></label>
        <textarea 
          style={textAreaStyle} 
          value={templates.after_ref} 
          onChange={(e) => setTemplates({...templates, after_ref: e.target.value})}
        />
      </div>

      <button 
        onClick={handleSave}
        style={{ padding: '15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        全ひな型を一括保存
      </button>
    </div>
  );
};

const textAreaStyle = { width: '100%', height: '150px', marginTop: '5px', padding: '10px', fontSize: '0.9rem', fontFamily: 'monospace' };

export default TemplateManager;