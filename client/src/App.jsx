import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { Play, Square, Undo, Trash2, Copy, Search, FolderPlus, Image as ImageIcon, Code, Terminal, ExternalLink, ClipboardPaste, Bot, Plus } from 'lucide-react';

const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const socket = io(serverUrl);

// ★ client.once("ready", ...) から client.once("clientReady", ...) に修正しました
const defaultCode = 'const { Client, GatewayIntentBits } = require("discord.js");\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });\n\nclient.once("clientReady", () => {\n  console.log(`Logged in as ${client.user.tag}!`);\n});\n\nclient.login(process.env.DISCORD_TOKEN);';

function App() {
  // ★ 複数Botのデータ管理（ローカルストレージから復元）
  const [bots, setBots] = useState(() => {
    const saved = localStorage.getItem('ide_bots');
    if (saved) {
      try {
        // リロード時は安全のため起動状態を一旦falseにする
        return JSON.parse(saved).map(b => ({...b, isRunning: false}));
      } catch(e) {}
    }
    return [{ id: Date.now().toString(), name: 'Bot 1', code: defaultCode, token: '', isRunning: false }];
  });
  
  const [currentBotId, setCurrentBotId] = useState(bots[0].id);
  const currentBot = bots.find(b => b.id === currentBotId) || bots[0];
  
  const [logs, setLogs] = useState({}); // { botId: 'logs...' }
  const [images, setImages] = useState([]);
  const [activeTab, setActiveTab] = useState('bots'); // 'bots', 'editor', 'console', 'assets'
  
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const logsEndRef = useRef(null);

  // データが更新されるたびにブラウザに保存
  useEffect(() => {
    localStorage.setItem('ide_bots', JSON.stringify(bots));
  }, [bots]);

  useEffect(() => {
    socket.on('log', ({ id, text }) => setLogs(prev => ({ ...prev, [id]: (prev[id] || '') + text })));
    socket.on('botStopped', ({ id }) => setBots(prev => prev.map(b => b.id === id ? { ...b, isRunning: false } : b)));
    return () => { socket.off('log'); socket.off('botStopped'); };
  }, []);

  useEffect(() => {
    if (activeTab === 'console') logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, activeTab, currentBotId]);

  const updateCurrentBot = (updates) => {
    setBots(bots.map(b => b.id === currentBotId ? { ...b, ...updates } : b));
  };

  const startBot = () => {
    if (!currentBot.token) return alert('トークンを入力してください');
    updateCurrentBot({ isRunning: true });
    setActiveTab('console');
    socket.emit('startBot', { id: currentBot.id, code: currentBot.code, token: currentBot.token });
  };

  const stopBot = () => {
    socket.emit('stopBot', { id: currentBot.id });
  };

  const handleAction = async (action) => {
    const editor = editorRef.current;
    if (!editor) return;
    switch (action) {
      case 'undo': editor.trigger('keyboard', 'undo', null); break;
      case 'clear': if(window.confirm('全消去しますか？')) updateCurrentBot({ code: '' }); break;
      case 'copy': navigator.clipboard.writeText(editor.getValue()); alert('コピーしました'); break;
      case 'paste': 
        try {
          const text = await navigator.clipboard.readText();
          editor.executeEdits("paste", [{ range: editor.getSelection(), text: text, forceMoveMarkers: true }]);
        } catch (err) { alert('画面を長押しして直接貼り付けてください。'); }
        break;
      case 'search': editor.getAction('actions.find').run(); break;
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await fetch(`${serverUrl}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      setImages([...images, { name: file.name, path: data.path }]);
    } catch (err) { alert('アップロード失敗'); }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1e1e1e] text-white overflow-hidden">
      
      {/* トップヘッダー: 選択中のBotを操作 */}
      <div className="flex flex-col p-2 bg-[#333333] border-b border-gray-700 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold truncate flex items-center">
            <Bot className="w-4 h-4 mr-2 text-blue-400" />
            {currentBot.name} <span className="text-xs text-gray-400 ml-2">(選択中)</span>
          </span>
          <div className="flex space-x-2">
            {!currentBot.isRunning ? (
              <button onClick={startBot} className="flex items-center bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded text-sm font-bold"><Play className="w-4 h-4 mr-1"/> 起動</button>
            ) : (
              <button onClick={stopBot} className="flex items-center bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded text-sm font-bold animate-pulse"><Square className="w-4 h-4 mr-1"/> 稼働中</button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="password"
            placeholder="Bot Token..."
            value={currentBot.token}
            onChange={(e) => updateCurrentBot({ token: e.target.value })}
            className="flex-1 bg-[#1e1e1e] text-white px-3 py-2 rounded text-xs border border-gray-600"
          />
          <button onClick={async () => {
            try { updateCurrentBot({ token: await navigator.clipboard.readText() }); } catch(e){}
          }} className="bg-gray-600 p-2 rounded"><ClipboardPaste className="w-4 h-4" /></button>
        </div>
      </div>

      {activeTab === 'editor' && (
        <div className="flex justify-around bg-[#252526] p-1 border-b border-gray-700">
          <button onClick={() => handleAction('undo')} className="p-3 text-gray-300"><Undo className="w-5 h-5"/></button>
          <button onClick={() => handleAction('paste')} className="p-3 text-gray-300"><ClipboardPaste className="w-5 h-5"/></button>
          <button onClick={() => handleAction('clear')} className="p-3 text-gray-300"><Trash2 className="w-5 h-5"/></button>
          <button onClick={() => handleAction('copy')} className="p-3 text-gray-300"><Copy className="w-5 h-5"/></button>
          <button onClick={() => handleAction('search')} className="p-3 text-gray-300"><Search className="w-5 h-5"/></button>
        </div>
      )}

      {/* メインエリア */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        
        {/* 1. Bot管理タブ */}
        <div className={`h-full flex flex-col p-4 overflow-y-auto ${activeTab === 'bots' ? 'block' : 'hidden'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold">Bot一覧</h2>
            <div className="flex space-x-2">
              <a 
                href="https://discord.com/developers/applications" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-bold"
                title="Discord Developer Portal"
              >
                <ExternalLink className="w-4 h-4 mr-1"/> Portal
              </a>
              <button onClick={() => setBots([...bots, { id: Date.now().toString(), name: `Bot ${bots.length + 1}`, code: defaultCode, token: '', isRunning: false }])} className="flex items-center bg-blue-600 px-3 py-1.5 rounded text-sm font-bold">
                <Plus className="w-4 h-4 mr-1"/> 新規作成
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {bots.map((b) => (
              <div key={b.id} onClick={() => { setCurrentBotId(b.id); setActiveTab('editor'); }} className={`p-4 rounded-lg border cursor-pointer flex justify-between items-center transition ${b.id === currentBotId ? 'border-blue-500 bg-[#2d2d2d]' : 'border-gray-700 bg-[#252526]'}`}>
                <div>
                  <input
                    type="text"
                    value={b.name}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setBots(bots.map(bot => bot.id === b.id ? {...bot, name: e.target.value} : bot))}
                    className="bg-transparent text-white font-bold focus:outline-none border-b border-dashed border-gray-500"
                  />
                  <div className="text-xs mt-2 flex items-center text-gray-400">
                    {b.isRunning ? <span className="text-green-400 font-bold mr-2">● 稼働中</span> : <span className="mr-2">○ 停止</span>}
                  </div>
                </div>
                {bots.length > 1 && (
                  <button onClick={(e) => {
                    e.stopPropagation();
                    if(window.confirm('削除しますか？')) {
                      if (b.isRunning) socket.emit('stopBot', { id: b.id });
                      const nextBots = bots.filter(bot => bot.id !== b.id);
                      setBots(nextBots);
                      if(currentBotId === b.id) setCurrentBotId(nextBots[0].id);
                    }
                  }} className="text-red-400 p-2"><Trash2 className="w-5 h-5"/></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 2. エディタ */}
        <div className={`h-full ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
          <Editor
            height="100%" theme="vs-dark" language="javascript"
            value={currentBot.code}
            onChange={(val) => updateCurrentBot({ code: val })}
            onMount={(ed) => editorRef.current = ed}
            options={{ minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', padding: { top: 12 } }}
          />
        </div>

        {/* 3. コンソール */}
        <div className={`h-full flex flex-col ${activeTab === 'console' ? 'block' : 'hidden'}`}>
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-[#4af626] bg-black">
            {logs[currentBotId] || 'ログはありません...'}
            <div ref={logsEndRef} />
          </div>
          <button onClick={() => setLogs(prev => ({...prev, [currentBotId]: ''}))} className="p-3 bg-gray-800 text-xs font-bold border-t border-gray-700">ログをクリア</button>
        </div>

        {/* 4. 画像アセット */}
        <div className={`h-full flex flex-col p-4 overflow-y-auto ${activeTab === 'assets' ? 'block' : 'hidden'}`}>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 py-3 rounded-lg text-sm font-bold mb-4 flex justify-center"><FolderPlus className="w-5 h-5 mr-2" /> 画像アップロード</button>
          {images.map((img, i) => (
            <div key={i} className="p-3 mb-2 bg-[#333333] rounded-lg border border-gray-700">
              <span className="text-sm truncate block mb-2">{img.name}</span>
              <button onClick={() => { navigator.clipboard.writeText(img.path); alert('コピー済'); }} className="bg-gray-600 px-3 py-1.5 rounded text-xs">パスをコピー</button>
            </div>
          ))}
        </div>
      </div>

      {/* ボトムナビゲーション */}
      <div className="flex bg-[#252526] border-t border-gray-700 h-16 pb-safe">
        <button onClick={() => setActiveTab('bots')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'bots' ? 'text-blue-400' : 'text-gray-400'}`}><Bot className="w-6 h-6 mb-1"/><span className="text-[10px] font-bold">管理</span></button>
        <button onClick={() => setActiveTab('editor')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'editor' ? 'text-blue-400' : 'text-gray-400'}`}><Code className="w-6 h-6 mb-1"/><span className="text-[10px] font-bold">コード</span></button>
        <button onClick={() => setActiveTab('console')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'console' ? 'text-blue-400' : 'text-gray-400'}`}><Terminal className="w-6 h-6 mb-1"/><span className="text-[10px] font-bold">ログ</span></button>
        <button onClick={() => setActiveTab('assets')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'assets' ? 'text-blue-400' : 'text-gray-400'}`}><ImageIcon className="w-6 h-6 mb-1"/><span className="text-[10px] font-bold">画像</span></button>
      </div>

    </div>
  );
}

export default App;