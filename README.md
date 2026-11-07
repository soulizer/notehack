# NoteHack

**把想法留下，把知识连起来。**

NoteHack 是一个安静、快速、本地优先的笔记空间：把记录、整理、排版、搜索、同步、分享与备份放在同一条路径上。界面统一为“午夜色书桌 + 温暖纸张”，Markdown 为底层格式，数据随时可以带走。

- 生产域名：<https://notehack.com>
- 仓库：<https://github.com/soulizer/notehack>
- 版本：0.1.0

---

## 为什么是 NoteHack

我们完整研究了九个开源笔记项目（Trilium、Joplin、Standard Notes、SilverBullet、Memos、Blinko、flatnotes、NoteDiscovery、Livebook），但没有把它们的界面拼在一起。总结出的共同点是：

> 用户敢把笔记交给你，前提是：不丢、能走、能恢复。

因此 NoteHack 的核心是：

- **稳定记录**：自动保存、草稿恢复、撤销、版本历史、离线 outbox、三向合并与冲突副本。
- **找得回来**：文件夹 + 标签 + 收藏/置顶 + 全文搜索（标题/正文/标签/附件名/OCR）+ 双向链接。
- **多端可用**：桌面三栏、移动单屏、可安装 PWA；快速捕获、网页剪藏、模板、快捷键。
- **安全透明**：TLS、scrypt、2FA、登录设备、恢复密钥、审计、附件与备份 AES-256-GCM；明确说明当前**不提供 E2EE**，服务器可读正文以支持搜索/分享/备份。
- **数据可携带**：单篇 Markdown/HTML/PDF；全库 Markdown + 附件/HTML/JSON；导入 Markdown/HTML/Evernote/Notion/CSV/JSON。
- **独立备份**：自动/手动/恢复前备份、下载/上传、恢复预览、合并/替换与时间点恢复。
- **克制的 UI**：主界面只保留新建、搜索、列表、编辑器与同步状态；低频功能进设置与命令面板。

**没有邮件。** NoteHack 不发送任何邮件，邀请、异常登录、评论等通知都在应用内；密码找回依赖恢复密钥。

---

## 快速开始（开发）

要求：Node.js ≥ 22，PostgreSQL ≥ 15。

```bash
git clone git@github.com:soulizer/notehack.git
cd notehack
npm install

# 创建数据库
sudo -u postgres psql -c "CREATE ROLE notehack LOGIN PASSWORD 'change-me'"
sudo -u postgres createdb -O notehack notehack

cp deploy/notehack.env.example .env
# 编辑 .env：DATABASE_URL / SESSION_SECRET / NOTEHACK_MASTER_KEY
npm run dev
```

- Web（Vite）：<http://localhost:5173>
- API：<http://127.0.0.1:8787>
- 首次注册的用户会成为实例管理员。
- 本地开发建议设置 `PUBLIC_ORIGIN=http://localhost:5173`；生产设置为 `https://notehack.com`。

生成密钥：

```bash
openssl rand -base64 32   # NOTEHACK_MASTER_KEY（必须 32 字节）
openssl rand -hex 32      # SESSION_SECRET
```

---

## 生产部署（摘要）

完整步骤见 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)。

```bash
npm ci
npm run build
sudo systemctl restart notehack
curl -fsS https://notehack.com/health
```

生产形态：

- Nginx 终止 TLS，代理到 `127.0.0.1:8787`；
- systemd 运行 API；
- PostgreSQL 本地；
- 数据在 `/var/lib/notehack`（0700）；
- 密钥在 `/etc/notehack/notehack.env`（0600）；
- 每日自动备份；备份/附件加密；
- Let's Encrypt 证书。

---

## 技术栈

- **前端**：React 19、TypeScript、Vite、TipTap 3（ProseMirror）、Zustand、IndexedDB、vite-plugin-pwa、cmdk、marked、DOMPurify、Turndown、node-diff3。
- **后端**：Fastify 5、PostgreSQL 15（FTS + pg_trgm）、TypeScript、zod、archiver、adm-zip、gray-matter、fast-xml-parser、cheerio/NodeHtmlMarkdown、qrcode、tesseract/pdftotext（可选）、Chromium（PDF）。
- **部署**：Nginx、systemd、Let's Encrypt、PostgreSQL。

---

## 测试

```bash
npm run typecheck
npm run build
# 现有验收脚本（需要先启动服务，并设置 NH_TEST_EMAIL / NH_TEST_PASSWORD）
node tests/manual/e2e-smoke.mjs
node tests/manual/share-test.mjs
node tests/manual/import-test.mjs
node tests/manual/backup-test.mjs
node tests/manual/totp-test.mjs
```

已记录的手工/自动化验证见 [`docs/MEMORY.md`](docs/MEMORY.md) 与 [`docs/QUALITY.md`](docs/QUALITY.md)。

```bash
npm test
```

`npm audit` 当前为 0 high / 0 critical；5 个 moderate 来自 archiver 7 → readdir-glob → minimatch（ZIP 构建输入由本应用控制）。

---

## 文档索引

| 文档 | 内容 |
|---|---|
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | 设计系统：token、字体、布局、组件、响应式、可访问性、反模式 |
| [`docs/FEATURES.md`](docs/FEATURES.md) | P0/P1/P2 功能规划、频率/位置、实现映射、验收 |
| [`docs/QUALITY.md`](docs/QUALITY.md) | 质量目标、测试矩阵、安全清单、性能预算、备份演练、发布检查 |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | 系统架构、数据模型、同步/冲突、安全、备份、导入导出 |
| [`docs/MEMORY.md`](docs/MEMORY.md) | 重要决策、debug 记录、测试结果、待办 |
| [`docs/RESEARCH.md`](docs/RESEARCH.md) | 九个开源项目的深入研究与取舍 |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | 生产部署、运维、备份恢复、升级、事故响应 |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | 版本历史 |
| [`docs/decisions/`](docs/decisions/) | ADR 决策记录 |

---

## 已知限制（诚实说明）

1. **不提供 E2EE**：服务端可读正文以支持搜索/分享/备份；附件/备份仅静态加密。隐私政策明确。
2. **离线仅覆盖打开过的笔记**：未预取全库；附件离线不可上传。
3. **没有实时协作/CRDT**：同时编辑同一笔记可能生成冲突副本；这是有意的安全选择。
4. **备份默认在同一服务器**：管理员可配置 S3 兼容异地备份；仍建议定期下载。
5. **无邮件**：忘记密码只能使用恢复密钥；请务必保存。
6. **OCR/PDF 依赖服务器环境**：tesseract/pdftotext/Chromium；未安装时降级并提示。
7. **界面语言**：v0.1 中文优先；英文翻译未完整，暂不暴露语言切换。
8. **导入不保证复杂格式 100% 保真**；预览会显示警告。

这些限制是产品取舍，不是隐藏的“以后再说”。路线见 `docs/FEATURES.md`。

---

## 安全与隐私

- 不发送邮件，不使用第三方分析，不把笔记用于训练 AI。
- AI 摘要默认关闭；只有用户主动点击时才发送当前笔记。
- 公开分享链接可能被搜索引擎索引；分享前请确认内容。
- 报告安全问题：请通过仓库 issue/实例管理员联系；不要在公开 issue 中粘贴敏感数据。

---

## License

AGPL-3.0-or-later. 见 [`LICENSE`](LICENSE)。

---

## 致谢

NoteHack 的设计来自对以下开源项目的学习，而不是复制：

- TriliumNext/Trilium
- standardnotes/app
- silverbulletmd/silverbullet
- gamosoft/NoteDiscovery
- usememos/memos
- livebook-dev/livebook
- laurent22/joplin
- dullage/flatnotes
- blinkospace/blinko

以及 React、TipTap、Fastify、PostgreSQL 与所有开源贡献者。
