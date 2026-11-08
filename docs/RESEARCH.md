# 竞品研究与设计推导

> 研究时间：2026-11-07  
> 研究对象（全部克隆到服务器并阅读代码与文档）：
> - [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium)
> - [standardnotes/app](https://github.com/standardnotes/app)
> - [silverbulletmd/silverbullet](https://github.com/silverbulletmd/silverbullet)
> - [gamosoft/NoteDiscovery](https://github.com/gamosoft/NoteDiscovery)
> - [usememos/memos](https://github.com/usememos/memos)
> - [livebook-dev/livebook](https://github.com/livebook-dev/livebook)
> - [laurent22/joplin](https://github.com/laurent22/joplin)
> - [dullage/flatnotes](https://github.com/dullage/flatnotes)
> - [blinkospace/blinko](https://github.com/blinkospace/blinko)
>
> 详细分项目报告保存在 `docs/research/`：
> - `big-three.md`（Trilium / Joplin / Standard Notes）
> - `silverbullet-memos-blinko.md`
> - `smaller-three.md`（flatnotes / NoteDiscovery / Livebook）

---

## 1. 研究方法与范围

不是“看 README 后总结”，而是对每个仓库做了以下工作：

1. 完整读取顶层 README、产品文档、部署文档、安全文档、路线图。
2. 阅读核心数据模型/迁移/Schema（SQL、Prisma、proto、Ecto schema）。
3. 阅读编辑器、同步、加密、分享、导入导出、搜索、移动端相关源码。
4. 对同一问题横向比较：数据身份、内容格式、权限边界、冲突策略、离线承诺、性能分层、UX 入口。
5. 只采纳与 NoteHack 定位相符的部分；明确拒绝会把产品推向“功能缝合怪”的做法。

研究结论必须能回答“他们为什么这样做，而不是另一种做法”。本文最后给出 NoteHack 的取舍，并在 `ARCHITECTURE.md` 与 `docs/decisions/` 中落地。

---

## 2. 九个项目的核心定位

| 项目 | 一句话定位 | 核心取舍 | 对 NoteHack 的最大启发 |
|---|---|---|---|
| **Trilium** | 面向个人的大型分层知识库 | 结构自由度极高（树、克隆、属性、脚本）换复杂度和单用户模型 | 稳定 ID、树/标签并存、版本快照、hoist/workspace 心智、同步日志 |
| **Joplin** | 离线优先、开放格式、多同步目标的笔记应用 | Markdown 真源 + 多端 + 可选 E2EE，牺牲富文本保真 | 冲突副本 + 三向合并、透明同步状态、导入导出与 note lock |
| **Standard Notes** | 协议优先、零知识、长期主义的加密笔记 | 强 E2EE 与可替换编辑器，牺牲大库性能与易用性 | 密钥层级、AES-GCM 现代基线、条目化模型、冲突 UI、沙箱扩展 |
| **SilverBullet** | 可编程、本地优先的 Markdown 知识库 | 全量本地副本 + 文件级同步 + Lua 扩展，牺牲实时协作 | PWA + IndexedDB + 双向同步、三向合并、对象索引、命令面板 |
| **Memos** | 时间线式短笔记 | 服务端权威、资源化 API、memo 级 audience，牺牲离线 | capability 分享、fail-closed 授权、标准化 ZIP 导出、API token |
| **Blinko** | AI 卡片笔记/快速捕获 | 卡片墙 + 类型化笔记 + AI 检索，牺牲离线与工程严谨 | 快速捕获、复习、命令入口、MCP/AI 作为可选层 |
| **flatnotes** | 极简、无数据库、单层 Markdown | 文件即真相、搜索优先，牺牲版本/分享/多用户 | “索引可丢弃”、极简默认、全文搜索即导航 |
| **NoteDiscovery** | 纯文件上的完整单用户知识库 | 目录树 + wikilink + graph + 分享，牺牲并发与版本 | 乐观并发 `base_hash`、统一索引、分享 token、HTML/zip 导出 |
| **Livebook** | 可执行、可协作的代码笔记本 | Document/Session 分离、OT 协作、能力声明 | 文档与运行时分离、纯文本容器、能力式分享、FileGuard |

---

## 3. 数据模型：他们共同做对了什么

### 3.1 稳定身份，而不是路径/标题

- Trilium：`notes.id` + `branches` 边表；克隆/多父级靠 branch，而不是复制正文。
- Joplin：每条 note 用稳定 ID 同步；标题可改，路径不影响身份。
- Standard Notes：UUID item，关系用 references。
- SilverBullet：文件路径目前仍承担部分身份，但其 object index 用对象引用与 link 解析；报告特别指出“路径即身份”的代价。
- flatnotes：标题 = 文件名 = URL，重命名会破坏链接，是明确的反模式。
- Memos：memo UID 是公开资源名，内部 ID 与 UID 分离。

**结论：** NoteHack 使用 UUID（数据库 `gen_random_uuid()`）作为笔记、文件夹、标签、分享、附件、版本的稳定身份。标题是可编辑字段；内部链接使用 `[[title]]` 但解析到目标 ID，重命名会尽量同步更新链接。导出时同时保留 ID 与标题，避免“恢复后链接全断”。

### 3.2 树是关系，标签是横切面

- Trilium 用 branches 支持同一笔记在多个位置；Joplin 用单父文件夹 + 多对多标签；Memos 用 Space 放置 + 标签；SilverBullet 用文件树 + tags + wikilink；Blinko 用层级 tag。
- 共同点：**树满足空间记忆（“它在哪”），标签/链接满足关联记忆（“它和什么有关”）**。
- 反模式：只做文件夹会限制复用；只做标签会失去结构感。

**结论：** NoteHack 同时提供文件夹树（单父级，稳定 ID）、多对多标签、收藏、置顶和双向链接。不做“多父级克隆”作为 v1 功能，避免删除、权限、导出的复杂度；在文档中保留为未来可扩展项。

### 3.3 内容格式是产品战略

- Trilium 选 HTML 真源：富文本保真高，但 Markdown 可移植性差、diff 噪声大。
- Joplin/SilverBullet/Memos/Blinko 选 Markdown：可读、可导出、可 diff；富文本能力受 Markdown 天花板限制。
- Standard Notes 用 note type + 可替换编辑器：扩展性强，但编辑器生态复杂。
- Livebook 用 `.livemd`（Markdown 子集 + 结构注释）：可 Git、可执行、可 round-trip。

**结论：** NoteHack 选 **Markdown 作为唯一可编辑真源**；标题单独存储，正文不重复 H1；前端用 TipTap 提供所见即所得，但保存时转回 Markdown。表格/任务/代码/图片都通过 GFM 或内嵌 HTML 表达。PDF/HTML 是投影，不是第二份真源。这个选择直接支撑“数据可携带”。

### 3.4 版本与墓碑

- Joplin 保留冲突副本、note revisions、deleted items；Trilium 有 revision + 墓碑 + change log；SN 有 revision + deleted 标记。
- 共同点：**删除必须可恢复；覆盖必须留下历史；同步删除需要墓碑，否则会被旧客户端复活。**

**结论：** NoteHack 用软删除 `trashed_at` + 30 天保留；版本表 `note_versions`（自动/手动/恢复/导入/冲突），每个笔记最多 60 个快照；删除与恢复不会物理覆盖活跃数据；永久删除清理附件。

---

## 4. 同步、离线与冲突：九个项目最一致、也最痛的部分

### 4.1 只有承诺离线，冲突处理才不是可选项

- SilverBullet、Joplin、Trilium 都做了真正的本地副本 + 双向同步；因此都必须面对冲突。
- Memos/Blinko 在线优先；Memos 直接 LWW；Blinko 只支持离线新建队列。
- flatnotes/NoteDiscovery 整文件覆盖或 `base_hash` 409；没有版本/合并。
- Livebook 用 OT 做同会话协作，但没有持久化 op log；跨文件仍靠 FileGuard。

**结论：** NoteHack 承诺离线编辑，因此必须做冲突检测与保留副本。我们采用：
1. 每条笔记有单调递增 `version`；
2. 客户端保存时带 `baseVersion`；
3. 服务端版本不一致返回 409 + 当前完整笔记；
4. 客户端用本地 `baseContent` + 本地修改 + 服务端当前内容做 **行级三向合并**（`node-diff3`）；
5. 无重叠修改自动合并；有真实冲突则创建“冲突副本”，绝静默覆盖；
6. 失败/离线时进入 IndexedDB outbox，联网后按笔记合并，而不是重放每个按键。

这比 SilverBullet 的整文件冲突副本更友好，比 Joplin 的三向合并更轻量（没有每设备 base 表，base 来自本地缓存），比 Trilium 的 LWW 更安全。

### 4.2 同步状态必须可见

- Joplin 在状态栏显示同步进度/错误；SilverBullet 有 Sync 状态与冲突 UI；Memos/Blinko 在保存/网络状态上较弱。
- 共同点：**用户必须知道“现在到底存了没有”**，尤其离线/多设备时。

**结论：** NoteHack 在编辑器顶栏用轻量圆点 + 文字显示保存中/已保存/离线/待同步/失败；失败有横幅（原因、重试、复制正文）；侧栏底部同样显示状态。备份/恢复/导入使用独立任务进度，不与同步状态混用。

### 4.3 为什么没有做 CRDT/实时协作

- SilverBullet 的 ADR 002 明确记录：CRDT 曾被尝试后移除，因为边界情况多；整文件冲突副本更稳。
- Livebook 的 OT 适合代码 cell，但实现复杂、需要会话状态与持久化 op log。
- 对个人/小团队笔记，实时协作不是 v1 的核心；真正的风险是丢数据，不是“两人同时改同一个字”的延迟。

**结论：** NoteHack v1 不做 CRDT、不做实时协同光标。提供评论、分享可编辑链接、版本历史与冲突副本。未来若做协作，优先 Yjs/Automerge + 持久化 op log，而不是自研 OT。

---

## 5. 安全与隐私：从“功能”到“架构属性”

### 5.1 密钥层级与密码派生

- Standard Notes：password → Argon2id → root key → items key → per-item key；XChaCha20-Poly1305 + AAD。
- Joplin：master password → master key（随机）→ 加密 notes/resources；master key 加密后同步。
- Trilium：scrypt → password-derived key → random data key → AES-128-CBC；protected session 内存中保存 data key，超时清除。

共同点：**不要让“用户密码”直接加密全库**。用随机 data key + 包裹（wrap）才能改密码 O(1)、分享单库/单篇、恢复密钥独立。

**NoteHack 取舍：** 本版本**不提供 E2EE**。我们不在 UI 中假装有 E2EE，也不把“附件 AES-GCM 加密存储”宣传成端到端加密。服务器需要读取正文以提供搜索、分享、备份与导入导出。密码使用 scrypt 加盐；会话令牌只存哈希；附件与备份在服务器上用 AES-256-GCM 加密；恢复密钥只存哈希。未来若提供 E2EE，按“root key → items key → per-note key”设计，并明确搜索/AI/分享/找回密码的失效范围。此决定记录在 `docs/decisions/006-e2ee-deferred.md`。

### 5.2 分享是 capability，不是“把笔记设为公开”

- Memos：share token + 过期 + 单资源 + 禁止 SPACE 分享，是最规范的之一；但其分享密码/明文 token 存储仍有改进空间。
- SilverBullet：分享是内容属性 + 外部 URI/OAuth，灵活但依赖外部。
- Blinko：8 位 ID + 明文密码 + 过期，报告明确批评其熵不足。
- Trilium：分享子树 + 只读 + 可选用户名密码；protected notes 不可分享。

**结论：** NoteHack 用 192-bit CSPRNG token（只存哈希 + AES-GCM 加密副本以便再次显示），支持 view/comment/edit、密码（scrypt）、过期、撤销、查看计数；公开页面不加载应用侧栏；密码访问使用短期签名 Cookie；分享编辑会把公开附件 URL 归一化回内部 URL，避免把分享 token 写进正文。链接页明确提示“可能被搜索引擎索引”“匿名可编辑的风险”。

### 5.3 认证与会话

- Joplin/Trilium/SN 都支持 2FA、恢复/备份、会话管理；NoteHack 采用：
  - scrypt 密码哈希（N=32768, r=8, p=1）；
  - HttpOnly + Secure + SameSite=Lax Cookie；生产 `__Host-` 前缀；
  - 服务端会话表（令牌哈希、设备 UA、IP、最后活动、过期、撤销）；
  - TOTP 2FA + 一次性备用码 + 重放保护；
  - 恢复密钥（只在生成时显示，哈希存储）；
  - 新 IP/设备登录应用内通知；
  - 全部状态变更要求 `X-NoteHack-CSRF: 1`，并校验 Origin（由 SameSite + 自定义头共同防护）；
  - 登录/注册/分享密码解锁/敏感操作限流。

### 5.4 无邮件约束

本产品明确**不发送任何邮件**。因此：
- 注册不需要邮箱验证；用邮箱作为唯一登录标识；
- 邀请通过复制链接（应用内通知已注册用户），不发送邮件；
- 密码找回只能使用恢复密钥；
- 异常登录、评论、邀请提醒全部在应用内；
- 无法通过邮件做“忘记邮箱”找回；文档明确警告保存恢复密钥。

这不是“功能缺失”，而是产品约束。它降低了外部依赖与域名信誉风险，也使用户必须承担恢复密钥的保管责任。`docs/QUALITY.md` 中有对应验收项。

---

## 6. 导入、导出与长期可迁移性

九个项目的共同点：**敢让用户走，用户才敢把笔记交给你。**

- Joplin：Markdown 真源 + JEX + HTML/PDF + ENEX 导入；多同步目标。
- Trilium：HTML/Markdown/OPML/ENEX/Notion/Keep/Anytype/Obsidian/OneNote 导入；静态 HTML 站点导出。
- Standard Notes：Plaintext/HTML/Evernote/Keep/Simplenote 导入；加密/解密备份双轨。
- Memos：ZIP + manifest + 每 memo JSON + 字节级 Markdown + attachments；可重复导入幂等。
- silverbullet：文件夹/Git；页面导出；Share 协议。
- flatnotes：文件本身就是导出。
- NoteDiscovery：HTML、打印、zip、API/MCP。

**NoteHack 结论：**
- 单篇：Markdown（带 frontmatter；有附件时 ZIP）、HTML（图片 base64 内嵌）、PDF（Chromium 生成）。
- 全库：Markdown + 附件目录（保留文件夹层级、标签、时间戳、内部链接）、HTML 静态站点、JSON 数据；CSV 摘要。
- 导入：Markdown/HTML/ENEX/Notion zip/CSV/JSON/ZIP；先预览（数量/文件夹/警告/示例）再执行；导入创建新笔记，不覆盖已有内容。
- 导出必须是可重建的；不做只有 NoteHack 能读的专有包。备份是另一条路径：`.nhbackup`（ZIP + manifest + workspace.json + attachments）用于完整恢复，独立于导出，也独立于同步。

---

## 7. 性能与规模：分层，而不是单点优化

九个项目展示了四层不同的策略：

1. **元数据缓存**：Trilium Becca 全量内存；Joplin SQLite + 虚拟列表；SN 全量 collection；SilverBullet 客户端对象索引。
2. **正文懒加载**：Trilium Froca；Joplin 附件按需；SN 按需解密；NoteDiscovery 按文件读。
3. **列表分页/虚拟化**：Joplin visible range；Trilium search limit；Memos offset；Blinko 缓存。
4. **同步批量化**：Trilium 32MB/4MB sector；Joplin 100/150 items；SN 150 items/批。

**NoteHack 结论：**
- PostgreSQL 元数据表 + `pg_trgm` + `tsvector` 索引；列表限制 100/页并支持 offset（当前客户端显示前 100，后续可加 keyset 分页）。
- 打开笔记才加载正文；列表只取摘要/标签/附件计数。
- 搜索用 FTS + ILIKE 兜底中文；标签/附件名/OCR 文本通过 EXISTS 子查询；结果限制 60。
- 附件按需读取并解密；图片懒加载；导出流式生成 ZIP。
- 主要性能目标是“首屏 < 1s、打开笔记 < 300ms、搜索 < 300ms（1 万笔记）”，详见 `QUALITY.md`。
- 反模式：不把全库正文塞进首屏；不在每次按键同步；不在主线程做 OCR/AI；不做无索引的 `%LIKE%` 全表扫描（用 trigram）。

---

## 8. UX：九个项目都同意的“三件套”

### 8.1 树 + 搜索 + 命令面板

- Trilium：note tree + Quick search + Jump to/command palette + hoisting。
- Joplin：notebook tree + full text search + Goto Anything。
- Standard Notes：tag tree + smart views + command palette。
- SilverBullet：page picker + wiki links + command palette。
- flintnotes：搜索优先 + 标签；NoteDiscovery：树 + 搜索 + graph + 大纲。
- Memos：时间线 + 标签 + 搜索；Blinko：卡片墙 + 搜索 + AI。

**为什么三者缺一不可：**
- 树利用**空间记忆**（“我记得它在工作/项目里”）。
- 搜索利用**关键词记忆**（“我记得出现过 docker”）。
- 命令面板利用**程序性记忆**（“我知道有个功能，但忘了在哪”）。

**NoteHack 结论：** 三者共用同一入口 `⌘/Ctrl + K`：默认搜索笔记 + 功能；输入即搜；结果分组（笔记 / 命令）；命令覆盖低频功能（备份、恢复、导出、导入、版本历史、2FA、API、AI、分享、设置）。同时保留侧栏树和列表搜索框。

### 8.2 主界面只放高频动作

- 用户给出的要求与竞品经验一致：主界面只常驻新建、搜索、笔记列表、编辑器、同步状态；侧栏只放全部笔记、收藏、标签、回收站（NoteHack 另加“最近编辑”和文件夹树，因为结构组织是必需项）。
- 中频：选中笔记后的上下文菜单、右侧信息面板、分享弹窗。
- 低频：设置中的账户/外观/编辑器/安全/数据/团队/API/AI/关于。
- 极低频：迁移、灾难恢复、审计 → 向导 + 命令面板。

### 8.3 默认值与渐进披露

- 分享默认“仅查看”；密码/过期折叠在“高级选项”。
- 导出默认“Markdown + 附件”；HTML/JSON 是可选预设。
- 导入先预览再执行；恢复先预览数量/方式；替换前自动安全备份。
- 新用户首屏只教记录、搜索、同步；不弹出 5 步向导。
- AI 默认关闭；只在单篇笔记的“…”菜单/命令面板出现；每次发送需主动点击。

### 8.4 移动端

- Trilium 的移动端是响应式 Web + 树在笔记下方；Joplin 有原生移动；Memos/Blinko 移动体验强。
- **NoteHack：** 单屏栈 + 侧栏抽屉 + 全屏编辑器 + 全屏信息面板；设置使用一屏 3×3 扁平导航；PWA 可安装；`/new` 快捷新建、`/search` 快捷搜索、Web Share Target `/clip`；Web Speech API 语音输入；离线队列。

---

## 9. 各项目“不可替代的贡献”与 NoteHack 的取舍

### 9.1 采纳

| 来源 | 采纳内容 | 在 NoteHack 的落地 |
|---|---|---|
| Trilium | 树 + 标签 + 稳定 ID + 版本快照 + hoist 心智 | 文件夹树、标签、版本历史、列表过滤 |
| Joplin | 开放 Markdown + 冲突副本 + 三向合并 + 透明状态 | Markdown 真源、baseVersion、`node-diff3`、保存状态/错误横幅 |
| Standard Notes | 密钥层级思想 + 现代 AEAD + 冲突 UI + 沙箱扩展 | AES-256-GCM 附件/备份、恢复密钥、未来 E2EE 设计 |
| SilverBullet | PWA + IndexedDB + 双向同步 + object index + 命令面板 | 离线缓存/outbox、搜索索引、命令面板、双向链接 |
| Memos | capability 分享 + fail-closed 授权 + 标准 ZIP + API token | 分享 token/哈希/过期/撤销、团队角色、导入导出、API 令牌 |
| Blinko | 快速捕获 + 复习/模板 + AI 可选层 | 快速新建、模板、PWA 分享目标、AI 摘要入口 |
| flatnotes | 索引可丢弃 + 极简默认 + 搜索即导航 | 列表优先、搜索入口、空状态极简 |
| NoteDiscovery | 乐观并发 + 统一索引 + 分享/导出产品化 | `baseVersion` 409、`pg_trgm`/FTS、HTML/zip 导出 |
| Livebook | Document/Session 分离 + 能力声明 | 笔记（持久）与分享/评论/任务（应用状态）分离；分享 capability；导入预览 |

### 9.2 改造

- **全量本地 SQLite → Postgres + IndexedDB 客户端缓存。** 理由：NoteHack 是公开多用户 Web 服务，需要团队、分享、审计、服务端全文检索；把所有内容放到每台设备的 SQLite 会大幅增加同步协议和权限复杂度。我们用 IndexedDB 缓存笔记/摘要/草稿/outbox，换取 Web 端多设备可用；代价是“未缓存的历史笔记离线不可读”，我们在质量/功能文档中明确标注，并计划做最近笔记预取。
- **实时协作/CRDT → v1 不做。** 用评论、可编辑分享链接、版本历史与冲突副本覆盖大部分协作需求；避免引入 Yjs/OT 的长期维护成本。
- **E2EE → 暂不提供。** 用 TLS + 附件加密 + 2FA + 恢复密钥 + 可下载备份建立基础信任；明确说明服务端可读正文。这是产品当前最重要的“诚实缺口”。
- **插件/脚本 → 不做内容级执行。** 笔记里不执行任意代码；API token + Web 剪藏 + 导入导出提供集成能力。

### 9.3 拒绝

- 拒绝“标题/路径即 ID”（flatnotes）。
- 拒绝默认无认证、默认 admin、默认 secret。
- 拒绝分享 token 明文落盘、无过期/无 scope、弱随机。
- 拒绝单文件覆盖、无版本、无回收站。
- 拒绝“有 PWA 壳但没有真正离线”的伪离线。
- 拒绝“每个功能都上主界面”的功能堆叠。
- 拒绝把 AI 作为默认/自动行为；拒绝把内容用于训练。
- 拒绝纯专有格式导出；拒绝只能依赖厂商备份。
- 拒绝无持久化 op log 的实时协作、默认执行任意代码。

---

## 10. 共性背后的“为什么”

1. **笔记是长期资产，不是会话。** 用户把一生笔记交出去的前提是：不丢、能走、能恢复。所以稳定 ID、版本、回收站、导出、备份是信任基础设施。
2. **网络不可靠。** 离线优先不是技术炫技，是用户在地铁/飞机/弱网下继续工作的基本预期。承诺离线就必须做冲突处理。
3. **笔记量会增长。** 首屏不加载全库正文、搜索必须有索引、列表必须分页/虚拟化、同步必须批量。性能是架构问题。
4. **组织是网状的。** 树给空间边界，标签给横向关联，链接给语义关系；单一模型无法满足全部回忆路径。
5. **权限边界决定数据模型。** 个人/团队/公开分享是不同边界；把 audience 作为查询谓词，而不是 UI 过滤，才能 fail-closed。
6. **安全是产品叙事，不是设置页。** 加密、2FA、恢复、分享、隐私政策必须一致；不能声称 E2EE 却让服务器搜索正文。
7. **发现性靠三种记忆入口。** 树、搜索、命令面板共用入口，低频功能在命令面板可搜，才叫“藏得有道理”。

---

## 11. NoteHack 的最终路线（v0.1）

- **身份与格式：** UUID；Markdown 真源；标题独立；附件按 UUID 存储；导出带 frontmatter/层级/附件。
- **组织：** 文件夹树、标签、收藏、置顶、回收站、最近、双向链接、反向链接。
- **同步：** 服务端权威 + 客户端 IndexedDB 缓存/草稿/outbox；`version` 乐观并发；409 三向合并；冲突副本；保存状态透明。
- **安全：** TLS、scrypt、HttpOnly 会话、CSRF、限流、2FA、备用码、恢复密钥、设备会话、审计、附件/备份 AES-256-GCM、无邮件、隐私政策。
- **备份：** 每日自动 + 手动 + 恢复前安全备份；保留策略；下载；上传；预览；合并/替换恢复；时间点恢复。
- **协作：** 团队工作区、角色、邀请链接、审计、单篇分享（查看/评论/编辑）、密码/过期/撤销、评论。
- **数据可携带：** 单篇 MD/HTML/PDF；全库 MD+附件/HTML/JSON；导入 MD/HTML/ENEX/Notion/CSV/JSON。
- **体验：** 三栏桌面 + 单屏移动 + 命令面板 + 模板 + 快捷键 + 黑暗模式 + PWA + 语音输入 + 网页剪藏 + AI 可选摘要。

更细的功能状态、频率与布局见 `docs/FEATURES.md`；架构与数据模型见 `docs/ARCHITECTURE.md`；设计规范见 `docs/DESIGN_SYSTEM.md`。
