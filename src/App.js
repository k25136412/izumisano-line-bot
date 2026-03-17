import React, { useState, useEffect } from 'react';
import { auth } from './firebase-config';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

// 各コンポーネントのインポート
import MatchList from './components/MatchList';
import TimeSlotManager from './components/TimeSlotManager';
import TemplateManager from './components/TemplateManager'; // もし作成済みなら

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('matches'); // matches, slots, templates

  // ログイン状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(err => alert("ログインエラー: " + err.message));
  };

  const handleLogout = () => signOut(auth);

  // ログインしていない時の画面
  if (!user) {
    return (
      <div style={{ textAlign: 'center', marginTop: '100px', padding: '20px' }}>
        <h1>⚽ 泉佐野チーム出欠管理</h1>
        <p>管理画面へアクセスするにはログインが必要です</p>
        <button onClick={handleLogin} style={loginBtnStyle}>
          Googleアカウントでログイン
        </button>
      </div>
    );
  }

  // ログイン後のメイン画面
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '10px' }}>
      <header style={headerStyle}>
        <span>👤 {user.displayName}</span>
        <button onClick={handleLogout} style={logoutBtnStyle}>ログアウト</button>
      </header>

      {/* タブナビゲーション */}
      <nav style={navStyle}>
        <button onClick={() => setActiveTab('matches')} style={tabStyle(activeTab === 'matches')}>試合登録</button>
        <button onClick={() => setActiveTab('slots')} style={tabStyle(activeTab === 'slots')}>時間割マスタ</button>
        <button onClick={() => setActiveTab('templates')} style={tabStyle(activeTab === 'templates')}>ひな型設定</button>
      </nav>

      {/* コンテンツの出し分け */}
      <main style={{ marginTop: '20px' }}>
        {activeTab === 'matches' && <MatchList />}
        {activeTab === 'slots' && <TimeSlotManager />}
        {activeTab === 'templates' && <TemplateManager />}
      </main>
    </div>
  );
}

// --- 簡易スタイル定義 ---
const loginBtnStyle = { padding: '15px 30px', fontSize: '1rem', backgroundColor: '#4285F4', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #ddd', fontSize: '0.9rem' };
const logoutBtnStyle = { background: 'none', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px' };
const navStyle = { display: 'flex', gap: '5px', marginTop: '10px' };
const tabStyle = (isActive) => ({
  flex: 1, padding: '10px', cursor: 'pointer', border: 'none',
  backgroundColor: isActive ? '#28a745' : '#e0e0e0',
  color: isActive ? '#fff' : '#333',
  fontWeight: isActive ? 'bold' : 'normal',
  borderRadius: '5px 5px 0 0'
});

export default App;