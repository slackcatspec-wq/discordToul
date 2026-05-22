import React, { useState, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { io } from 'socket.io-client';
import { Play, Square, Undo, Trash2, Copy, Search, FolderPlus, Image as ImageIcon } from 'lucide-react';

// 開発中はポート3000、本番は同一オリジン
const serverUrl = import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin;
const socket = io(serverUrl);

function App() {
  const [code, setCode] = useState('const { Client, GatewayIntentBits } = require("discord.js");\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });\n\nclient.once("ready", () => {\n  console.log(`Logged in as ${client.user.tag}!`);\n});\n\n// tokenは画面上部で入力するためコード内には書きません\nclient.login(process.env.DISCORD_TOKEN);');
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState('');
  const [images, setImages] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
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
    socket.emit('startBot', { code, token });
  };

  const stopBot = () => {
    socket.emit('stopBot');
    setIsRunning(false);
  };

  const handleAction = (action) => {
    const editor = editorRef.current;
    if (!editor) return;

    switch (action) {
      case 'undo':
        editor.trigger('keyboard', 'undo', null);
        break;
      case 'clear':
        if(window.confirm('コードを全消去しますか？')) setCode('');
        break;
      case 'copy':
        navigator.clipboard.writeText(editor.getValue());
        alert('コードをコピーしました');
        break;
      case 'search':
        editor.getAction('actions.find').run();
        break;
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const res = await fetch(`${serverUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setImages([...images, { name: file.name, path: data.path }]);
    } catch (err) {
      alert('画像のアップロードに失敗しました');
    }
  };

  return (
    <div className="flex h-screen bg-[#1e1e1e] text-white overflow-hidden">
      {/* 左サイドバー: 画像管理 */}
      <div className="w-64 border-r border-gray-700 p-4 bg-[#252526] flex flex-col">
        <h2 className="text-sm font-bold mb-4 flex items-center text-gray-300">
          <FolderPlus className="w-4 h-4 mr-2" /> アセット
        </h2>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-sm py-2 rounded mb-4 transition duration-200"
        >
          画像をアップロード
        </button>
        <div className="space-y-2 overflow-y-auto flex-1">
          {images.map((img, i) => (
            <div key={i} className="flex justify-between items-center p-2 bg-[#333333] rounded text-xs group">
              <span className="truncate flex items-center w-2/3">
                <ImageIcon className="w-3 h-3 mr-2 shrink-0"/>
                {img.name}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(img.path);
                  alert('パスをコピーしました: ' + img.path);
                }}
                className="text-blue-400 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition"
              >
                パス複製
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* メインエディタエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* トップツールバー */}
        <div className="h-14 border-b border-gray-700 bg-[#333333] flex items-center justify-between px-4">
          <div className="flex space-x-3 items-center">
            <input
              type="password"
              placeholder="Bot Tokenを入力..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="bg-[#1e1e1e] text-white px-3 py-1.5 rounded text-sm w-72 border border-gray-600 focus:outline-none focus:border-blue-500"
            />
            {!isRunning ? (
              <button onClick={startBot} className="flex items-center bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm font-bold transition">
                <Play className="w-4 h-4 mr-1.5"/> 起動
              </button>
            ) : (
              <button onClick={stopBot} className="flex items-center bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm font-bold transition">
                <Square className="w-4 h-4 mr-1.5"/> 停止
              </button>
            )}
          </div>
          <div className="flex space-x-1">
            <button onClick={() => handleAction('undo')} className="p-2 hover:bg-gray-600 rounded text-gray-300 transition" title="1つ戻る"><Undo className="w-4 h-4"/></button>
            <button onClick={() => handleAction('clear')} className="p-2 hover:bg-gray-600 rounded text-gray-300 transition" title="全消去"><Trash2 className="w-4 h-4"/></button>
            <button onClick={() => handleAction('copy')} className="p-2 hover:bg-gray-600 rounded text-gray-300 transition" title="全コピー"><Copy className="w-4 h-4"/></button>
            <button onClick={() => handleAction('search')} className="p-2 hover:bg-gray-600 rounded text-gray-300 transition" title="検索"><Search className="w-4 h-4"/></button>
          </div>
        </div>

        {/* エディタ */}
        <div className="flex-1 relative">
          <Editor
            height="100%"
            theme="vs-dark"
            language="javascript"
            value={code}
            onChange={(val) => setCode(val)}
            onMount={handleEditorDidMount}
            options={{ minimap: { enabled: false }, fontSize: 15, padding: { top: 16 } }}
          />
        </div>
      </div>

      {/* ターミナル（ログ）エリア */}
      <div className="w-96 border-l border-gray-700 bg-[#1e1e1e] flex flex-col">
        <div className="p-3 border-b border-gray-700 bg-[#252526] text-sm font-bold text-gray-300 flex justify-between items-center">
          <span>コンソール出力</span>
          <button 
            onClick={() => setLogs('')}
            className="text-xs text-gray-400 hover:text-white transition"
          >
            クリア
          </button>
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-sm whitespace-pre-wrap text-[#4af626] bg-black">
          {logs}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

export default App;