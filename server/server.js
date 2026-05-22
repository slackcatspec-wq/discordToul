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
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

// 画像アップロード設定
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

let botProcess = null;

// 画像アップロードAPI
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');
  const imagePath = `./uploads/${req.file.originalname}`;
  res.json({ path: imagePath });
});

// Botプロセス管理 (WebSocket)
io.on('connection', (socket) => {
  socket.on('startBot', ({ code, token }) => {
    if (botProcess) {
      botProcess.kill();
    }

    const botCodePath = path.join(__dirname, 'temp_bot.js');
    // トークンを環境変数として注入してからコードを実行
    const executableCode = `
      process.env.DISCORD_TOKEN = "${token}";
      ${code}
    `;
    
    fs.writeFileSync(botCodePath, executableCode);
    socket.emit('log', 'Botを起動中...\n');
    
    // 生成したコードを実行
    botProcess = spawn('node', [botCodePath]);

    botProcess.stdout.on('data', (data) => socket.emit('log', data.toString()));
    botProcess.stderr.on('data', (data) => socket.emit('log', `エラー: ${data.toString()}`));

    botProcess.on('close', (code) => {
      socket.emit('log', `\nBotプロセスが終了しました (終了コード: ${code})`);
      botProcess = null;
    });
  });

  socket.on('stopBot', () => {
    if (botProcess) {
      botProcess.kill();
      socket.emit('log', 'Botを強制停止しました。\n');
      botProcess = null;
    }
  });
});

// 本番環境ではReactのビルドファイルを配信する
app.use(express.static(path.join(__dirname, '../client/dist')));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});