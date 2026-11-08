# Changelog

All notable changes to NoteHack are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use [Semantic Versioning](https://semver.org/).

## [0.1.2] — 2026-11-08

全站体验修正：主题、折叠侧栏、字体回退、内联命名、通知深链与图标统一。

### Changed

- 浅色主题的侧栏改为暖纸色，深色主题保持深色；workspace mark、导航、文件夹树、标签、用户区全部跟随主题 token。
- 折叠侧栏改为两行布局：`N.` 在上，通知与展开按钮在下；折叠图标随状态切换。
- 编辑器富文本显式使用无衬线字体；Markdown 源码/代码块的中文回退加入系统中文字体，避免落到宋体。
- 导出 HTML/PDF、全库 HTML 索引移除 Newsreader/Songti/Georgia，链接 hover 不再出现下划线。
- 新建/重命名文件夹与标签改为列表内联命名，Enter/失焦保存、Esc 取消；删除仍二次确认。
- 通知支持深链：评论定位到目标评论，共享编辑打开对应版本；通知行显示“查看评论/查看修改”等动作。
- 登录用户评论他人笔记也会通知笔记作者。
- favicon/PWA/apple-touch 统一由同一个几何 N. SVG 生成；移除 Globe2 浏览器式图标；登录设备统一为单一设备图标。
- 信息面板在 1440px 下并排显示，不再遮挡正文；设置导航 active 不再产生 1px 边框位移。
- Nginx 对 `/` 与静态图标使用 no-cache，hashed `/assets/` 长缓存；Workbox 清理旧缓存，避免旧 CSS/旧图标残留。

### Fixed

- 管理员“运行概况”统计卡高度不一致（grid 子项误继承 sibling margin）。
- 折叠侧栏 logo/通知/折叠图标重叠。
- 浅色主题侧栏不跟随主题。
- Logo 悬停下划线。
- 共享笔记评论/编辑通知无法直接打开内容。

### Verification

- typecheck、server 14 + web 3 tests、build 通过。
- Playwright 验证主题、折叠、内联命名、信息面板、管理员统计、通知评论/版本深链。
- 临时测试数据已清理，未删除用户笔记或既有登录设备。

---

## [0.1.1] — 2026-11-08

入口、视觉与错误体验纠偏。此版本没有新增功能，重点是去掉营销外壳与“AI 味”，把产品本身放到第一屏。

### Changed

- **入口即产品**：`/` 直接进入 `/app`；未登录显示登录页。删除营销首页及其样式。
- **全站无衬线**：移除 Newsreader、宋体/衬线 token 与编辑器衬线偏好；登录、笔记标题、分享页、导出、错误页统一 Inter/系统无衬线。
- **字号下限 13px**：隐私政策、服务条款、忘记密码、时间戳、错误说明等全部提升；“任何文字不得小于 13px”写入设计规范与验收清单。
- **品牌改为文字标识**：`NoteHack.`（蓝色句点），PWA/favicon 为同源 `N.`；删除旧图形 logo。
- **按钮统一**：标准 36px / 小号 30px / 大号 44px；圆角 8/7px；同一层级的边框、内边距、字体一致。
- **去掉廉价交互**：删除 hover 下划线、按钮上浮/缩放、active 位移、选中态额外 ring；hover 只改变颜色或背景。
- **边框纪律**：修复搜索/新建按钮溢出、选中态双边框、共享权限卡与设置导航的阴影描边；相邻元素保持单层 1px 边框。
- **空状态与文案**：去掉 emoji 与 Sparkles 图标，改用书写类图标；种子笔记去掉 👋；降低“AI 生成”语气。
- **错误体验**：Nginx 静态直出 SPA；502/503/504 显示 NoteHack 品牌 503 页；前端把网关错误转为可读中文，不再渲染 Nginx HTML。

### Fixed

- 注册 502：`archiver@8` ESM 启动失败导致 API 不可用；回滚 `archiver@7.0.1` 并重新部署。
- API 重启时登录页不再整站 502：静态资源由 Nginx 提供。
- `www` 与 HTTP 重定向、HSTS/CSP 保持。

### Docs

- `docs/DESIGN_SYSTEM.md` 升级 0.2：禁止衬线、13px 下限、禁止 hover 位移/下划线、按钮分级、边框规则、直接登录、错误页、反模式与验收清单。
- `docs/MEMORY.md` 记录视觉纠偏与“每次更新立即推送 GitHub”铁律。

---

## [0.1.0] — 2026-11-07

首个可部署版本。目标：把“稳定记录、找得回来、多端可用、安全透明、可携带、可恢复”做扎实。

### Added

**应用与编辑**

- React PWA：三栏桌面布局、移动单屏、可安装、暗色模式、命令面板。
- TipTap 富文本编辑器 + Markdown 源码模式；标题/列表/表格/任务/引用/代码块/图片/附件/链接/双向链接。
- 自动保存（800ms）、草稿恢复、撤销、版本历史（最多 60 个快照）、回收站。
- 模板：会议记录、日报、项目简报；斜杠菜单；格式快捷键；语音输入（Web Speech API）。
- 图片拖动/粘贴上传；附件 AES-256-GCM 加密存储；OCR 可选（tesseract + pdftotext）。
- 网页剪藏 bookmarklet、PWA 快捷方式 `/new`、`/search`、Web Share Target `/clip`。

**组织与搜索**

- 文件夹树、标签、收藏、置顶、最近编辑、回收站。
- 全文搜索：标题/正文/标签/附件名/OCR；FTS + trigram + ILIKE；结果片段。
- 双向链接与反向链接；文件夹/标签过滤；排序（更新/创建/标题/打开）。
- 批量选择、批量删除/恢复/永久删除。

**同步与离线**

- IndexedDB 工作区/笔记缓存、草稿、outbox。
- 服务端版本号乐观并发；409 时行级三向合并（node-diff3）。
- 冲突保留副本；保存状态透明（保存中/已保存/离线/待同步/失败）。
- 离线本地新建、联网后转正式笔记；失败横幅可重试/复制正文。

**分享与团队**

- 单篇分享链接：只读/评论/编辑、密码、过期、撤销、查看计数。
- 公开分享页：目录、作者/时间、附件、评论、匿名评论、打印、编辑 Markdown。
- 团队工作区、成员角色、邀请链接、转移所有权、移除/离开/删除、审计日志。
- 评论与解决状态；应用内通知。

**安全**

- scrypt 密码哈希；HttpOnly/Secure/SameSite Cookie；CSRF 自定义头；限流。
- TOTP 2FA + 10 个备用码 + 重放保护；登录设备列表/撤销；异常登录应用内通知。
- 恢复密钥（注册生成、哈希存储、重置密码、轮换）。
- 附件/备份 AES-256-GCM；分享 token 哈希 + 加密副本；CSP/HSTS/nosniff。
- 无邮件；无第三方分析；AI 默认关闭且需主动触发；隐私政策与条款（中/英）。
- 账号注销、空间删除、附件/备份清理。

**数据**

- 单篇导出：Markdown/ZIP、HTML（图片 base64）、PDF（Chromium）。
- 全库导出：Markdown + 附件、HTML 站点、JSON、CSV 摘要。
- 导入：Markdown、HTML、Evernote (ENEX)、Notion、CSV、JSON、ZIP；预览/执行两阶段。
- 备份：每日自动、手动、恢复前安全备份；下载/上传/预览/合并/替换/时间点恢复；保留策略；S3 兼容异地备份（上传/删除/连接测试）。
- API 令牌（Bearer、scope 限制、撤销）；令牌只允许 notes/folders/tags/search/attachments/export，不能管理会话/备份/管理设置。
- 最近 120 篇离线预取；列表“加载更多”。
- 实例管理页（统计、用户、备份保留、全局审计）。
- S3 兼容异地备份（上传/删除/连接测试）。

**文档**

- 设计系统、功能规划、质量规范、架构、研究、记忆、ADR、运维手册、CHANGELOG。

### Security

- 生产缺少 `SESSION_SECRET` / `NOTEHACK_MASTER_KEY` 会启动失败。
- 分享列表要求分享权限；分享编辑归一化公开附件 URL；路径穿越/MIME/大小校验。
- 恢复密钥重置会撤销全部会话并关闭 2FA。

### Fixed

- 标题与正文首个 H1 重复：服务端/客户端剥离，分享与 HTML/PDF 导出一致。
- 全库 Markdown 导出的附件相对路径按文件夹深度计算；全库 HTML 的 wiki link 转为相对页面链接。
- 分享密码/过期/撤销流程；公开编辑把公开附件 URL 归一化回内部 URL。
- 生产 PDF 导出在 systemd 非 root 下需要可写 HOME/XDG 与 `--user-data-dir`，已修复。
- ENEX 导入剥离 XML prolog/DOCTYPE，不再把声明写入正文。
- TOTP 防重放；2FA 关闭支持备用码；分享列表要求分享权限。
- 静态资源 404 时不再回退 HTML；build 后重启服务的运维要求写入文档。
- 批量选择/恢复/永久删除 UI；列表“加载更多”；最近 120 篇离线预取。

### Known limitations / not in 0.1

- 不提供 E2EE（明确说明服务端可读正文）。
- 离线仅缓存打开过的笔记；附件离线不可上传。
- 无 CRDT/实时协同；无 @提及、Webhook、插件、MCP、异地备份。
- 中文全文搜索依赖 trigram/ILIKE；超大规模需专门搜索服务。
- 英文 UI 未完整翻译；v0.1 中文优先，语言切换暂不暴露。完整英文 UI 为 P1。
- PDF/OCR 依赖服务器安装 Chromium/tesseract/pdftotext。

### Verification

- TypeScript/typecheck + Vite build 通过。
- 登录/注册/自动保存/刷新持久化、分享公开页、备份创下载预览合并替换、导入、单篇 MD/HTML/PDF、全库 MD/HTML、2FA 开启/登录/关闭、暗色/移动端截图均通过。
- 备份替换生成 pre-restore 安全备份；0 错误。
