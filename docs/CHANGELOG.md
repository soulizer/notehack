# Changelog

All notable changes to NoteHack are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions use [Semantic Versioning](https://semver.org/).

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
