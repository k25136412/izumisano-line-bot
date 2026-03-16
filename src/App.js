import React, { useState } from 'react';
import MatchList from './components/MatchList';
import TimeSlotManager from './components/TimeSlotManager';
import TemplateManager from './components/TemplateManager';

// スタイル（簡易版）
const styles = {
  header: { 
    backgroundColor: '#282c34', 
    padding: '15px', 
    color: 'white', 
    textAlign: 'center',
    fontSize: '1.2rem' // スマホで見やすいサイズ
  },
  nav: { 
    display: 'flex', 
    flexWrap: 'wrap', // 幅が足りない時に折り返す
    justifyContent: 'center', 
    backgroundColor: '#eee', 
    padding: '5px' 
  },
  navButton: { 
    margin: '5px', 
    padding: '12px 15px', // 指で押しやすい高さ
    flex: '1 1 100px',    // スマホではボタンを広げる
    cursor: 'pointer', 
    fontSize: '0.9rem'
  },
  container: { 
    maxWidth: '1000px', 
    margin: '0 auto', 
    padding: '10px' 
  }
};

function App() {
  // 表示中の画面を管理するステート (Enumのような感覚)
  const [currentView, setCurrentView] = useState('matchList');

  // 条件付きレンダリング
  const renderView = () => {
    switch (currentView) {
      case 'matchList': return <MatchList />;
      case 'timeSlots': return <TimeSlotManager />;
      case 'templates': return <TemplateManager />;
      default: return <MatchList />;
    }
  };

  return (
    <div>
      <header style={styles.header}>
        <h1>⚽ 泉佐野試合連絡 管理システム</h1>
      </header>

      {/* ナビゲーションメニュー */}
      <nav style={styles.nav}>
        <button 
          style={{...styles.navButton, ...(currentView === 'matchList' ? styles.activeButton : {})}}
          onClick={() => setCurrentView('matchList')}
        >
          試合一覧・登録
        </button>
        <button 
          style={{...styles.navButton, ...(currentView === 'timeSlots' ? styles.activeButton : {})}}
          onClick={() => setCurrentView('timeSlots')}
        >
          時間割マスタ
        </button>
        <button 
          style={{...styles.navButton, ...(currentView === 'templates' ? styles.activeButton : {})}}
          onClick={() => setCurrentView('templates')}
        >
          ひな型設定
        </button>
      </nav>

      {/* メインコンテンツ */}
      <main style={styles.container}>
        {renderView()}
      </main>
    </div>
  );
}

export default App;