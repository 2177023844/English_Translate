# 果冻学英语

个人英语学习网站：**四六级 + 考研词汇**，打字记忆 + FSRS 间隔复习 + 语音跟读。

- 前端：React 19 + Vite + TypeScript + Tailwind CSS v4 + TanStack Query + ECharts
- 后端：Node.js (≥20) + Express 5 + better-sqlite3（SQLite）
- 复习算法：[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)（FSRS 间隔重复）
- 语音：浏览器 Web Speech API（发音 + 跟读识别，免费无需 API Key）
- 词库：[KyleBing/english-vocabulary](https://github.com/KyleBing/english-vocabulary)（BSD-3-Clause，见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)）
- 单用户个人使用（数据表已按用户维度设计，预留多用户/认证接口）

## 快速开始（开发）

```bash
# 1. 安装依赖（首次安装需批准安装脚本）
npm install
npm approve-scripts better-sqlite3 esbuild

# 2. 导入词库（幂等，可重复运行；数据缓存在 scripts/.cache/）
npm run seed                # 全部三本
npm run seed -- --books CET4      # 仅指定
npm run seed -- --offline         # 仅用本地缓存

# 3. 启动开发环境（前端 5173，后端 3001，自动代理 /api）
npm run dev
```

打开 http://localhost:5173 即可使用。

### 页面功能

| 页面 | 说明 |
|---|---|
| 首页 | 四个数据卡片（点击打开弹窗）：**打卡天数**（日历，完成任务标红/未完成学习目标标黄）、**已累积学习词数**（连续 7 天柱状图 + 柱顶数字 + 日期选择 + 总数）、**今日学习数**（单词明细 + 彩色日历选日期）、**今日复习数**（单词明细 + 选日期） |
| 学习 | 词书选择 → 按设置的学习模式出题：**中→英四选一**（干扰项拼写/意思接近）或 **英→中四选一**（干扰项为易混淆释义）。所有汉语释义均标注词性。快捷键：1-4 选答案；每日额度用完后可"再学一组" |
| 学习操作 | **跳过（认识）**：FSRS 记 Easy，数天后仅在复习中出现；**收藏**：加入生词本；**不认识**：FSRS 记 Again（1 分钟后复习），本次会话内多次推送（最多 5 次） |
| 复习 | 与学习一致的选择题形式（按设置的学习模式出题）：答对→Good、答错/不认识→Again、跳过→Easy；支持跨词书 |
| 生词本 | 收藏单词列表，支持发音 |
| 统计 | 30 天学习曲线、词书进度 |
| 拼写 | 给出汉语+词性，拼写今天学过/复习过的单词（可在设置中开启，学习/复习结束后入口提示） |
| 翻译 | 输入汉语或英语查询单词：英文精确/前缀匹配，中文按释义检索并只显示命中义项；点击结果卡片进入详情页（顶部搜索栏 + 词书来源 + 丰富释义/用法/例句 + ⭐收藏入生词本） |
| 设置 | 每天学习几组单词（最少 1 组，每天总量 = 组数 × 每组数量）、每组学习单词数、每天复习单词数（5 ~ 词书单词数）、学习模式（中→英 / 英→中）、美音/英音、自动发音、拼写测试开关 |

## 线上部署（VPS + Nginx + HTTPS + PM2）

```bash
# 1. 服务器上拉取代码
git clone <your-repo> && cd <dir>

# 2. 安装与构建
npm install && npm approve-scripts better-sqlite3 esbuild
npm run seed                 # 导入词库
npm run build                # 构建前端 + 后端

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：NODE_ENV=production（可改 PORT；DATABASE_PATH 默认即可）

# 4. PM2 启动（单实例！SQLite 不支持多进程写）
npm i -g pm2
pm2 start deploy/ecosystem.config.cjs
pm2 save && pm2 startup    # 开机自启

# 5. Nginx + HTTPS（推荐开启 HTTPS 保证传输安全）
sudo apt install nginx certbot python3-certbot-nginx
# 将 deploy/nginx.conf 内容放入 /etc/nginx/sites-available/vocab（替换域名），软链启用
sudo certbot --nginx -d <你的域名>
```

生产模式由 Express 同源托管前端构建产物 + API（端口 3001），无 CORS 问题。

### 数据备份

```bash
# WAL 热备（无需停服）
sqlite3 server/data/app.db "VACUUM INTO 'backups/app-$(date +%F).db'"
```

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发模式（双端热更新） |
| `npm run seed` | 导入/刷新词库（幂等） |
| `npm run build` | 生产构建 |
| `npm start` | 生产运行（先 build） |
| `npm run lint -w client` | 前端 lint |

## 目录结构

```
client/    React 前端（Vite）
server/    Express 后端 + SQLite（migrations/ 为 SQL 迁移）
scripts/   seed.ts 词库导入脚本（sources.json 定义词书）
deploy/    nginx.conf、PM2 配置
```
