import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { Play, Square, Undo, Trash2, Copy, Search, FolderPlus, Image as ImageIcon, Code, Terminal, ExternalLink, ClipboardPaste } from 'lucide-react';

const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const socket = io(serverUrl);

function App() {
  const [code, setCode] = useState('const { Client, GatewayIntentBits } = require("discord.js");\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });\n\nclient.once("ready", () => {\n  console.log(`Logged in as ${client.user.tag}!`);\n});\n\nclient.login(process.env.DISCORD_TOKEN);');
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState('');
  const [images, setImages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState('editor');
  
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const logsEndRef = useRef(null);

  useEffect(() => {
    socket.on('log', (data) => setLogs((prev) => prev + data));
    return () => socket.off('log');
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const startBot = () => {
    if (!token) return alert('Discord Botのトークンを入力してください');
    setIsRunning(true);
    setLogs('起動リクエストを送信...\n');
    setActiveTab('console');
    socket.emit('startBot', { code, token });
  };

  const stopBot = () => {
    socket.emit('stopBot');
    setIsRunning(false);
  };

  // クリップボードからトークンを貼り付け
  const handlePasteToken = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setToken(text);
    } catch (err) {
      alert('ブラウザの設定でブロックされました。入力欄を長押しして直接貼り付けてください。');
    }
  };

  const handleAction = async (action) => {
    const editor = editorRef.current;
    if (!editor) return;
    switch (action) {
      case 'undo': editor.trigger('keyboard', 'undo', null); break;
      case 'clear': if(window.confirm('全消去しますか？')) setCode(''); break;
      case 'copy': navigator.clipboard.writeText(editor.getValue()); alert('コピーしました'); break;
      case 'paste': 
        try {
          const text = await navigator.clipboard.readText();
          editor.executeEdits("paste", [{ range: editor.getSelection(), text: text, forceMoveMarkers: true }]);
        } catch (err) {
          alert('ブラウザの設定でブロックされました。画面を長押しして直接貼り付けてください。');
        }
        break;
      case 'search': editor.getAction('actions.find').run(); break;
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(`${serverUrl}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      setImages([...images, { name: file.name, path: data.path }]);
    } catch (err) {
      alert('アップロード失敗');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1e1e1e] text-white overflow-hidden">
      
      {/* トップヘッダー (2段構成に変更) */}
      <div className="flex flex-col p-2 bg-[#333333] border-b border-gray-700 space-y-2">
        {/* 上段：リンクと起動/停止ボタン */}
        <div className="flex items-center justify-between">
          <a 
            href="https://discord.com/developers/applications" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center text-xs text-blue-400 hover:text-blue-300 font-bold bg-[#252526] px-3 py-1.5 rounded border border-gray-600 transition"
          >
            <ExternalLink className="w-3 h-3 mr-1" /> トークン作成ページ
          </a>
          {!isRunning ? (
            <button onClick={startBot} className="flex items-center justify-center bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-bold transition whitespace-nowrap">
              <Play className="w-4 h-4 mr-1"/> 起動
            </button>
          ) : (
            <button onClick={stopBot} className="flex items-center justify-center bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-bold transition whitespace-nowrap">
              <Square className="w-4 h-4 mr-1"/> 停止
            </button>
          )}
        </div>

        {/* 下段：トークン入力と貼り付けボタン */}
        <div className="flex items-center space-x-2">
          <input
            type="password"
            placeholder="Bot Tokenを貼り付け..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="flex-1 bg-[#1e1e1e] text-white px-3 py-2 rounded text-sm border border-gray-600 focus:outline-none focus:border-blue-500 w-full"
          />
          <button 
            onClick={handlePasteToken} 
            className="flex items-center justify-center bg-gray-600 hover:bg-gray-500 p-2 rounded text-sm font-bold transition"
            title="クリップボードから貼り付け"
          >
            <ClipboardPaste className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* エディタ用ツールバー */}
      {activeTab === 'editor' && (
        <div className="flex justify-around bg-[#252526] p-1 border-b border-gray-700">
          <button onClick={() => handleAction('undo')} className="p-3 text-gray-300 hover:text-white" title="元に戻す"><Undo className="w-5 h-5"/></button>
          <button onClick={() => handleAction('paste')} className="p-3 text-gray-300 hover:text-white" title="貼り付け"><ClipboardPaste className="w-5 h-5"/></button>
          <button onClick={() => handleAction('clear')} className="p-3 text-gray-300 hover:text-white" title="全消去"><Trash2 className="w-5 h-5"/></button>
          <button onClick={() => handleAction('copy')} className="p-3 text-gray-300 hover:text-white" title="コピー"><Copy className="w-5 h-5"/></button>
          <button onClick={() => handleAction('search')} className="p-3 text-gray-300 hover:text-white" title="検索"><Search className="w-5 h-5"/></button>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
        {/* 1. コードエディタ */}
        <div className={`h-full ${activeTab === 'editor' ? 'block' : 'hidden'}`}>
          <Editor
            height="100%"
            theme="vs-dark"
            language="javascript"
            value={code}
            onChange={(val) => setCode(val)}
            onMount={handleEditorDidMount}
            options={{ 
              minimap: { enabled: false }, 
              fontSize: 14, 
              wordWrap: 'on',
              padding: { top: 12 },
              lineNumbersMinChars: 3
            }}
          />
        </div>

        {/* 2. コンソールログ */}
        <div className={`h-full flex flex-col ${activeTab === 'console' ? 'block' : 'hidden'}`}>
          <div className="flex-1 p-3 overflow-y-auto font-mono text-xs whitespace-pre-wrap text-[#4af626] bg-black">
            {logs}
            <div ref={logsEndRef} />
          </div>
          <button onClick={() => setLogs('')} className="p-3 bg-gray-800 text-xs font-bold text-center border-t border-gray-700 active:bg-gray-700">
            ログをクリア
          </button>
        </div>

        {/* 3. 画像アセット */}
        <div className={`h-full flex flex-col p-4 overflow-y-auto ${activeTab === 'assets' ? 'block' : 'hidden'}`}>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-600 py-3 rounded-lg text-sm font-bold mb-4 flex justify-center items-center active:bg-blue-700">
            <FolderPlus className="w-5 h-5 mr-2" /> 画像をアップロード
          </button>
          <div className="space-y-3">
            {images.map((img, i) => (
              <div key={i} className="flex flex-col p-3 bg-[#333333] rounded-lg border border-gray-700">
                <span className="text-sm truncate mb-3">{img.name}</span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(img.path); alert('パスをコピーしました\n' + img.path); }} 
                  className="bg-gray-600 py-2 rounded text-xs font-bold active:bg-gray-500"
                >
                  パスをコピー
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ボトムナビゲーション */}
      <div className="flex bg-[#252526] border-t border-gray-700 h-16 pb-safe">
        <button onClick={() => setActiveTab('editor')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'editor' ? 'text-blue-400' : 'text-gray-400'}`}>
          <Code className="w-6 h-6 mb-1"/>
          <span className="text-[10px] font-bold">コード</span>
        </button>
        <button onClick={() => setActiveTab('console')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'console' ? 'text-blue-400' : 'text-gray-400'}`}>
          <Terminal className="w-6 h-6 mb-1"/>
          <span className="text-[10px] font-bold">コンソール</span>
        </button>
        <button onClick={() => setActiveTab('assets')} className={`flex-1 flex flex-col items-center justify-center ${activeTab === 'assets' ? 'text-blue-400' : 'text-gray-400'}`}>
          <ImageIcon className="w-6 h-6 mb-1"/>
          <span className="text-[10px] font-bold">アセット</span>
        </button>
      </div>

    </div>
  );
}

export default App;