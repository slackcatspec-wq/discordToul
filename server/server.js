import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// 24時間稼働（スリープ防止）のためのアクセス窓口
app.get('/api/ping', (req, res) => res.send('pong'));

// 画像アップロード設定
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  res.json({ path: `./uploads/${req.file.originalname}` });
});

// ★複数Botを管理するMap (BotのIDをキーにしてプロセスを保持)
const activeBots = new Map();

io.on('connection', (socket) => {
  
  socket.on('startBot', ({ id, code, token }) => {
    // 既に同じBotが動いていればキルする
    if (activeBots.has(id)) activeBots.get(id).kill();

    // ★ 拡張子を .cjs に変更することで、"type": "module" 環境下でも require が使用可能になります
    const botCodePath = path.join(__dirname, `temp_bot_${id}.cjs`);
    fs.writeFileSync(botCodePath, `process.env.DISCORD_TOKEN = "${token}";\n${code}`);
    
    socket.emit('log', { id, text: 'Botを起動中...\n' });
    const botProcess = spawn('node', [botCodePath]);
    activeBots.set(id, botProcess);

    botProcess.stdout.on('data', (data) => socket.emit('log', { id, text: data.toString() }));
    botProcess.stderr.on('data', (data) => socket.emit('log', { id, text: `エラー: ${data.toString()}` }));

    botProcess.on('close', (codeStatus) => {
      socket.emit('log', { id, text: `\nBotプロセスが終了しました (コード: ${codeStatus})` });
      activeBots.delete(id);
      socket.emit('botStopped', { id }); // フロントに停止を通知
      
      // クリーンアップ: 不要になった一時ファイルを削除（オプションですが推奨）
      if (fs.existsSync(botCodePath)) {
        fs.unlinkSync(botCodePath);
      }
    });
  });

  socket.on('stopBot', ({ id }) => {
    if (activeBots.has(id)) {
      activeBots.get(id).kill();
      socket.emit('log', { id, text: 'Botを強制停止しました。\n' });
      activeBots.delete(id);
      socket.emit('botStopped', { id });
    }
  });

});

app.use(express.static(path.join(__dirname, '../client/dist')));
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Server on ${PORT}`));