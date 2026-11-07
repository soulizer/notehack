# NoteHack 记忆文档

> 用途：保存重要决策、debug 结论、功能变更、测试结果与待办。  
> 规则：当天发生的事当天记录；不写密码/密钥/令牌；事实优先，包含日期、文件、命令与结果。  
> 关联：`CHANGELOG.md`（对外版本）、`docs/decisions/`（架构决策）、`docs/QUALITY.md`（验收）。

---

## 2026-11-07 · 项目起点与架构定稿

### 背景

- 域名：`notehack.com` / `www.notehack.com`，DNS 指向本机。
- 仓库：`https://github.com/soulizer/notehack.git`。
- 服务器：Debian 12，4 vCPU / 8GB RAM / 40GB，PostgreSQL 15、Nginx、Node 26、Docker；无其他生产项目。
- 要求：以九个开源笔记项目为强制参考；先文档化设计/功能/质量/记忆；统一设计；功能分 P0/P1/P2；不能发邮件；不能污染域名信誉。

### 研究

- 克隆并阅读了：Trilium、Joplin、Standard Notes、SilverBullet、Memos、Blinko、flatnotes、NoteDiscovery、Livebook。
- 报告：
  - `docs/research/big-three.md`（Trilium / Joplin / Standard Notes）
  - `docs/research/silverbullet-memos-blinko.md`
  - `docs/research/smaller-three.md`（flatnotes / NoteDiscovery / Livebook）
- 综合：`docs/RESEARCH.md`。核心共同点：稳定 ID、Markdown/可迁移、树+标签+搜索、冲突副本、透明同步、导入导出、分层性能、命令面板/树/搜索三入口。
- 关键“为什么”：笔记是长期资产，用户敢托付的前提是不丢、能走、能恢复；只有承诺离线才必须做冲突处理；权限粒度决定查询模型；安全必须是叙事而不是设置页。

### 架构选择（与竞品差异）

- **服务端权威 PostgreSQL + React PWA/IndexedDB 缓存**，而不是把全量 SQLite 放到每个客户端。原因：多用户/团队/分享/审计/FTS 需要服务端；Web 端多设备可用；实现/运维更可控。代价：未缓存的历史笔记离线不可读；附件离线不可上传。已在 `FEATURES.md`/`QUALITY.md` 标注，计划预取最近 200 篇。
- **Markdown 为唯一真源**；TipTap 只是编辑器；标题独立；重复 H1 自动剥离。
- **冲突**：`version` 乐观并发 + 客户端 `node-diff3` 行级三向合并 + 冲突副本；不做 CRDT。
- **E2EE 不提供**：不假装；附件/备份 AES-256-GCM 只是静态加密。恢复密钥只保存哈希。
- **无邮件**：邀请链接 + 应用内通知 + 恢复密钥；不引入 SMTP。
- **备份**：独立 `.nhbackup`（ZIP 加密存储）；自动/手动/pre-restore；合并/替换恢复；预览。
- **团队**：workspace + 角色（owner/admin/editor/viewer）+ 邀请 + 审计。
- **AI**：默认关闭；实例管理员配置 OpenAI 兼容接口；用户主动点击；不训练；加密笔记不发送。
- **设计**：午夜侧栏 + 暖纸内容 + Signal Blue；Newsreader 衬线标题 + Inter UI；深色模式；三栏→单屏。

### 已完成的主要实现

- Monorepo：`apps/server`（Fastify 5 + PostgreSQL）、`apps/web`（React 19 + Vite + TipTap 3）、`packages/shared`。
- 数据库迁移：用户/会话/2FA/恢复密钥/工作区/成员/邀请/文件夹/笔记/标签/附件/版本/分享/评论/链接/通知/API token/审计/备份/任务/设置/登录尝试。
- 认证：注册（首个用户 admin）、登录、2FA（TOTP + 备用码）、恢复密钥重置、修改密码、会话管理、设备列表、异常登录通知、API token。
- 笔记：CRUD、自动保存、版本、回收站、收藏/置顶、移动、批量删除/恢复、双向链接/反向链接、评论。
- 搜索：FTS + trigram + ILIKE；标题/正文/标签/附件名/OCR；命令面板。
- 编辑器：TipTap 富文本 + Markdown 源码；表格/代码/任务/图片/附件/链接；80+ 格式工具；斜杠菜单；拖入/粘贴上传；语音输入；模板。
- 离线：IndexedDB 缓存/草稿/outbox；本地新建；联网 flush；409 合并/冲突副本。
- 分享：view/comment/edit、密码、过期、撤销、公开页、附件、评论、编辑、打印。
- 团队：工作区、邀请链接、角色、审计、转移所有权、删除空间（硬删）。
- 数据：单篇 MD/HTML/PDF；全库 MD+附件/HTML/JSON/CSV；导入 MD/HTML/ENEX/Notion/CSV/JSON/ZIP，带预览/执行。
- 备份：自动/手动/pre-restore；下载/上传；预览；合并/替换恢复；保留策略。
- 设置：账户/外观/编辑器/安全/数据/团队/API/AI/关于；命令面板覆盖低频功能。
- PWA：manifest、service worker、快捷方式 `/new` `/search`、分享目标 `/clip`；图标。
- 安全：scrypt、CSRF header、限流、Helmet CSP、附件 AES-GCM、备份 AES-GCM、路径校验、分享 token 哈希、TOTP 防重放。
- 文档：设计系统、功能规划、质量规范、架构、研究、ADR、CHANGELOG、本记忆、部署/运维。

### 关键文件

```
apps/server/src/index.ts              API 启动/静态/安全头/调度
apps/server/src/migrations/001_init.sql
apps/server/src/services/notes.ts     笔记/版本/链接
apps/server/src/services/backups.ts   备份/恢复
apps/server/src/lib/import-parser.ts  导入解析
apps/server/src/services/export.ts    导出
apps/server/src/routes/*.ts           路由
apps/web/src/stores/app.ts            同步/冲突/离线
apps/web/src/lib/offline.ts           IndexedDB
apps/web/src/components/editor/*      编辑器
apps/web/src/pages/*                  应用/登录/分享/法律
apps/web/src/styles/tokens.css        设计 token
```

### 调试记录（重要）

1. **dotenv 找不到根 `.env`**：npm workspace 的 cwd 是 `apps/server`，`import 'dotenv/config'` 读不到根目录。改为显式 `dotenv.config({ path: repoRoot/.env })`。
2. **静态资源返回 text/html**：Fastify `@fastify/static` 在启动时注册文件路由；重新 build 后新 hash 文件未被注册，SPA fallback 把 `/assets/*.css` 返回 index.html。修复：`notFound` 对 `/assets/*` 和常见静态扩展直接 404；生产 build 后重启服务。开发用 Vite。
3. **分享链接指向 localhost:5173**：`PUBLIC_ORIGIN` 是 dev Vite 地址。改为实际访问 origin；生产为 `https://notehack.com`。
4. **标题重复 H1**：笔记标题字段 + 正文 H1 显示两次。服务端 `stripTitleHeading` + 客户端 `stripDuplicateTitle`；保存/加载/分享/HTML/PDF 均处理。此变更会规范化旧笔记。
5. **TOTP 立即重登失败**：启用时记录了 `totp_last_step`，同一 30 秒 code 再用于登录被重放保护拒绝。真实用户不会立即重登；测试时使用下一窗口 code 或备用码。不要关闭重放保护。
6. **2FA 关闭只接受 TOTP**：UI 写“验证码或备用码”；已修复后端 disable 接受备用码并标记已用。
7. **分享权限文字挤在一行**：`.share-permission-name/desc` 需 `display:block; text-align:left`。
8. **公开分享编辑会把公开附件 URL 写回正文**：保存时服务端把 `/api/public/shares/<token>/attachments/<id>` 归一化回 `/api/attachments/<id>/content`；否则后续应用内图片失效。
9. **分享管理列表越权**：原列表接口只检查读权限；已改为 `canShare`（editor/admin/owner）。
10. **PDF meta 与标题重叠**：导出 HTML `.meta` 负数 margin 改为正常间距；PDF 已验证 1 页可读、含图片。
11. **全库 Markdown 附件相对路径**：原实现写成 `attachments/...`；已改为根据笔记层级加 `../` 前缀；单篇 ZIP 保持根相对。
12. **全库 HTML wiki link**：补 `data-note-title` 允许属性，导出时按标题映射到相对 HTML 文件。
13. **标签创建后 context 不显示**：原因是先更新笔记后刷新标签，乐观 note tags 为空；改为先 `refreshTags` 再 `updateNoteMeta`。仍需在真实 UI 复测。
14. **服务器进程被 SIGTERM**：开发时用 `pkill -f` 会匹配当前 shell 的命令行，导致误杀。生产使用 systemd；调试用 `ss -tlnp` 取 PID 后 kill。
15. **备份替换已验证**：备份 5 篇/1 文件夹/1 评论/7 版本；replace 后笔记数 5，自动生成 pre-restore（12 篇）备份；merge 生成 12 篇副本。0 错误。
16. **异地备份（S3）已验证**：本地 s3rver 模拟，配置/连接测试/备份上传/列表 badge/删除全部通过；测试后已删除 offsite 设置与测试备份，避免污染生产。

### 测试记录

- **性能基准（10,000 篇，PostgreSQL 本机）**：列表查询 8.7ms；中文关键词搜索（含标题/正文/标签 OR）55ms；count 59ms。目标“1 万笔记搜索 < 300ms”通过。测试库已删除。
- 登录/注册/自动保存/刷新持久化：通过（Playwright）。
- 分享只读公开页（无登录）：通过；`/s/<token>` 渲染标题/正文/作者/日期。
- 新建笔记、标签、评论、历史、命令面板、搜索：通过（标签 UI 显示待复测）。
- 备份创建/下载/预览/合并/替换：通过；pre-restore 生成。
- 导入 sample ZIP（2 篇 + 1 图片 + 2 文件夹）：通过；预览/执行/完成。
- 单篇 MD ZIP/HTML/PDF：通过；PDF 1 页、图片内嵌；字体/中文正常。
- 全库 MD/HTML ZIP：通过；层级/附件相对路径/wiki link 已验证。
- 2FA 开启、登录（下一窗口 code）、关闭：通过；备用码生成 10 个。
- 暗色桌面、移动端登录/列表/编辑器/设置截图：通过；无 JS errors。
- `npm run typecheck` server/web：通过；`npm run build` web：通过。

### 待办（按优先级）

- [ ] 生产部署：systemd、Nginx、TLS（notehack.com/www）、环境密钥、管理员账户。
- [ ] 重置生产数据库为干净状态（当前为测试数据）；重新注册管理员并妥善保存恢复密钥。
- [ ] 将 deploy key 加入 GitHub 并 push 全仓；若未加，需用户操作。
- [x] 明确 v0.1 中文优先；语言切换暂时隐藏，避免中英混排；英文完整翻译为 P1。
- [ ] 离线最近 200 篇预取；附件离线队列（P1）。
- [x] 异地备份 S3 兼容（P1）已实现并验证；WebDAV/远端直接恢复待加。
- [x] 1 万笔记性能基准：列表 8.7ms / 搜索 55ms；5 万待测。
- [x] 最近 120 篇离线预取；离线刷新/编辑/联网合并实测通过。
- [x] S3 兼容异地备份实现并在本地 s3rver 验证；生产测试配置已清理。
- [x] 批量选择、实例管理页、API token scope 限制、OCR/ENEX 导入验证。
- [ ] 2FA/备份/恢复/导入导出 E2E 自动化固化。
- [ ] 生产监控/日志/告警、备份定时器验证。
- [ ] 清理测试用户/测试笔记/测试分享/测试备份；保留干净初始状态。
- [ ] 替换内存中的 `notehack.com` OG 图/社交预览（可选）。
- [ ] 完整审查英文/隐私/条款与实际行为一致性。

### 环境/凭据（不入库）

- 生产密钥只放 `/etc/notehack/notehack.env`，权限 0600；不写入仓库/文档。
- 测试账户仅用于开发，部署前删除。

### 决策链接

- `docs/decisions/001-web-first-offline-cache.md`
- `002-markdown-truth-and-title.md`
- `003-conflict-version-merge.md`
- `004-security-no-email.md`
- `005-backup-independent.md`
- `006-e2ee-deferred.md`
- `007-no-crdt-realtime.md`

---

## 2026-11-08 · 生产上线

### 部署结果

- 域名：`https://notehack.com`（`www` 301 到 apex）；HTTP 301 到 HTTPS。
- TLS：Let's Encrypt，证书到期 2027-02-05；`certbot.timer` 已启用；无邮箱注册。
- 服务：systemd `notehack.service` 运行 `/opt/notehack/apps/server/dist/index.js`，`127.0.0.1:8787`；Nginx 终止 TLS。
- 数据库：PostgreSQL 本地；生产库已重置为干净状态。
- 数据目录：`/var/lib/notehack`（0700）；env：`/etc/notehack/notehack.env`（0600）。
- 最终状态：1 个管理员、3 篇种子笔记、0 会话、0 分享、0 备份、0 附件、0 团队空间；管理员与恢复密钥保存在 `/root/notehack-admin-initial.txt`（0600），生产密钥备份在 `/root/notehack-secrets-backup.txt`（0600，应复制到离线后删除）。
- 未配置 AI、未配置 S3 异地；注册模式 `open`。
- Git：`main` 已推送到 `github.com:soulizer/notehack`（deploy key 已添加）；最终提交 `cf29d55`。

### 最终验证

- HTTPS 健康检查通过；CSP/HSTS/XFO DENY/Permissions-Policy 存在；`www` 重定向。
- PWA：manifest 3 icons、2 shortcuts、share_target `/clip`；service worker 已控制；离线刷新/编辑/联网合并通过。
- 桌面/移动/暗色/设置/分享弹窗/实例管理页无 JS 错误。
- 分享密码/错误密码/解锁/撤销 404；公开页渲染正常。
- 2FA 开启/登录/关闭、TOTP 防重放；恢复密钥机制。
- 备份创建/下载/预览/合并/替换；pre-restore 生成；S3 兼容异地备份在 s3rver 验证后清理。
- 导入 Markdown ZIP、ENEX（修复 XML prolog 后）、OCR 图片；搜索/附件命中。
- API token read-only：GET 200、POST 403、auth 403；撤销后 401。
- 10k 笔记基准：列表 8.7ms、搜索 55ms。
- 单元测试：server 7、web 3；typecheck/build 通过。
- npm audit：0 high/critical；5 moderate（archiver 7 → readdir-glob → minimatch DoS；ZIP 输入由本应用控制，记录待上游修复）。

### 上线后事故与修复

- 尝试升级 `archiver@8` 以消除 moderate audit：其 ESM 无 default export，导致服务启动失败（502）。快速回滚到 `archiver@7.0.1`，重新构建/部署，健康恢复。教训：依赖 major 升级必须在独立 staging 启动验证；本次已记录。
- PDF 在生产 501：systemd 非 root 下 Chromium 需要可写 HOME/XDG 目录与 `--user-data-dir`；已修复 `pdfFromHtml`，PDF 导出恢复（311KB/2 页验证）。静态首页/导出/备份不受影响。
- 当前生产会话已清理；管理员需重新登录。

### 未完成/后续

- 全库离线预取仅最近 120 篇；附件离线不可上传。
- 无 E2EE、无实时协同/CRDT、无 @提及/Webhook/MCP。
- 英文 UI 暂不开放。
- 异地备份无应用内远端浏览/直接恢复。
- 5 万笔记性能、自动备份定时实跑、恢复演练自动化待补。
- 管理员初始密码需用户登录后修改；恢复密钥需离线保存。
