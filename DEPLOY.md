# 本機 Hosting 部署筆記

這個專案目前是單一 Node/Express app：前端在 `public/`，API 和 SQLite 寫入在 `server.js`。因此正式可操作的 hosting 不能只把檔案丟到 S3/GCS；最小可用方案是讓 Node app 跑在本機或一台小 VM，再把 HTTP 入口安全地導出去。

## 建議架構

```text
手機/瀏覽器
  -> Cloudflare Tunnel HTTPS
  -> 本機 cloudflared
  -> http://127.0.0.1:3000
  -> Node/Express
  -> data/baseball.db
```

適合情境：

- 自己或少數人記錄比賽
- 不想買固定 IP
- 不想設定 router port forwarding
- 可以接受本機關機、睡眠、斷網時服務會中斷

不適合情境：

- 正式公開服務
- 多人高併發同時寫入
- 需要 24/7 SLA

## 本機啟動

```bash
npm install
BASEBALL_DB_PATH="$PWD/data/baseball.db" PORT=3000 npm start
```

確認服務：

```bash
curl -s http://127.0.0.1:3000/api/health
```

## Cloudflare Tunnel

1. 安裝 `cloudflared`
2. 登入 Cloudflare：

```bash
cloudflared tunnel login
```

3. 建立 tunnel：

```bash
cloudflared tunnel create baseball-recorder
```

4. 將 `deploy/cloudflared/config.example.yml` 複製成你的實際設定，例如：

```bash
cp deploy/cloudflared/config.example.yml ~/.cloudflared/baseball-recorder.yml
```

5. 編輯以下 placeholder：

- `<TUNNEL_ID>`
- `<ABSOLUTE_PATH_TO_TUNNEL_CREDENTIALS_JSON>`
- `score.example.com`

6. 綁定 DNS：

```bash
cloudflared tunnel route dns baseball-recorder score.example.com
```

7. 前景測試：

```bash
cloudflared tunnel --config ~/.cloudflared/baseball-recorder.yml run baseball-recorder
```

8. 確認手機可開 `https://score.example.com`。

9. tunnel 確認沒問題後，再裝成常駐服務：

```bash
cloudflared service install
```

如果不想用 system service，也可以用 macOS `launchd` 跑 `cloudflared tunnel --config ~/.cloudflared/baseball-recorder.yml run baseball-recorder`。

## 常駐方式：PM2

PM2 適合先快速保活 Node app。

```bash
npm install -g pm2
pm2 start deploy/pm2/ecosystem.config.cjs
pm2 save
pm2 startup
```

如果專案路徑不是 `/Users/al02499373/git/other/baseball-recorder`，請先修改 `deploy/pm2/ecosystem.config.cjs` 裡的 `cwd` 與 `BASEBALL_DB_PATH`。

## 常駐方式：launchd

macOS 原生方式可用 `launchd`。先複製範本：

```bash
cp deploy/launchd/com.example.baseball-recorder.plist ~/Library/LaunchAgents/com.example.baseball-recorder.plist
```

編輯 plist 內的：

- `<PROJECT_DIR>`
- `<NODE_BINARY>`

載入：

```bash
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.example.baseball-recorder.plist
launchctl enable "gui/$(id -u)/com.example.baseball-recorder"
launchctl kickstart -k "gui/$(id -u)/com.example.baseball-recorder"
```

停止：

```bash
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.example.baseball-recorder.plist
```

## SQLite 備份

建議至少每天備份一次 `data/baseball.db`。

本機備份：

```bash
scripts/backup-sqlite.sh
```

備份到 GCS：

```bash
GCS_URI="gs://your-bucket/baseball-recorder" scripts/backup-sqlite.sh
```

備份到 S3：

```bash
S3_URI="s3://your-bucket/baseball-recorder" scripts/backup-sqlite.sh
```

備份到 rclone remote：

```bash
RCLONE_REMOTE="gdrive:baseball-recorder" scripts/backup-sqlite.sh
```

可放進 crontab：

```cron
0 2 * * * cd /Users/al02499373/git/other/baseball-recorder && BASEBALL_BACKUP_DIR=backups scripts/backup-sqlite.sh >> logs/backup.log 2>&1
```

## 上線前檢查

- `npm test`
- `curl -s http://127.0.0.1:3000/api/health`
- 手機用外部網路打開 tunnel 網址
- 確認電腦不會睡眠
- 確認 `data/baseball.db` 有定期備份
- 確認沒有把 tunnel token、credentials JSON、`.env` commit 進 repo

## Rollback

如果 tunnel 或常駐服務設定壞掉：

1. 先確認本機服務仍可用：

```bash
BASEBALL_DB_PATH="$PWD/data/baseball.db" PORT=3000 npm start
```

2. 暫停 tunnel 常駐服務。
3. 回到前一版設定檔。
4. 確認 `/api/health` 與手機頁面都恢復。
