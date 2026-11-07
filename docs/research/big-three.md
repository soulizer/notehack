# NoteHack 竞品深度研究：Trilium、Joplin、Standard Notes

> 研究时间：2026-11-07。对象为 `/root/research/Trilium`、`/root/research/joplin`、`/root/research/app` 的当前代码与文档。以下结论来自对 schema、同步协议、加密实现、编辑器、导入导出、分享与移动端 UX 的源码阅读；路径均为仓库内真实文件。

---

## 一、Trilium Notes

### 1.1 产品哲学：个人大型知识库，结构自由优先

Trilium 的定位是 “hierarchical note taking application with focus on building large personal knowledge bases”（`README.md`）。它面向 power user、研究者和开发者，核心卖点是：任意深的树、同一笔记可出现在多个位置（cloning）、属性/关系/继承、脚本、ETAPI、100k 笔记规模。关键取舍是**单用户、自托管、结构自由度极高**：服务端一个安装只有一个 owner，没有多租户和团队权限（`docs/Developer Guide/Developer Guide/Architecture/Security.md`）；桌面版也运行本地 Express + SQLite 后端（`Architecture.md`）；移动端是连服务器的响应式 Web 前端，而非独立离线客户端（`docs/User Guide/User Guide/Installation & Setup/Mobile Frontend.md`）。这换来了逻辑统一和隐私自主，但协作与移动离线能力弱。

### 1.2 数据模型：树是关系，不是字段

`packages/trilium-core/src/assets/schema.sql` 用少量表表达极灵活的结构：

- `notes`：`title`、`type`、`mime`、`blobId`、`isProtected`、时间戳；正文在 `blobs.content`。
- `branches`：`noteId`、`parentNoteId`、`notePosition`、`prefix`、`isExpanded`。**父子关系是独立实体**，因此一篇笔记可有多个 branch，即 cloning。
- `attributes`：label/relation、`name`/`value`、`isInheritable`；标签不是独立 tag 表，而是挂在笔记上的属性。
- `revisions`、`attachments`、`blobs`：历史、附件、内容寻址存储。
- `entity_changes`：同步变更日志。

组织方式是**树 + 标签/关系 + 保存搜索**三套并存。克隆让同一笔记出现在 Work/Project/Archive 多个上下文，但所有树操作都要处理 DAG：删 branch 不等于删 note、导出和搜索要处理多父级、权限与回收站更复杂。`ALLOWED_NOTE_TYPES` 包含 text、code、file、image、canvas、mermaid、book、webView、mindMap、spreadsheet、llmChat 等（`packages/commons/src/lib/rows.ts`），类型决定渲染器、编辑器和导出行为。

### 1.3 编辑器：HTML 为真源，多编辑器共存

文本笔记以 **HTML** 存在 blob 中，编辑器是深度定制的 CKEditor 5（`packages/ckeditor5`、`apps/client/src/widgets/type_widgets/text/CKEditor.tsx`、`config.ts`）；代码笔记用 CodeMirror 6（`packages/codemirror`）；其他类型各有 widget（`apps/client/src/widgets/type_widgets/`）。Markdown 是“进出口语言”：导入转 HTML，导出用 Turndown 转换（`packages/trilium-core/src/services/export/markdown.ts`、`zip/markdown.ts`）。官方明确 HTML 是主格式，Markdown 尽量兼容（`docs/.../Import & Export.md`）。

Trade-off：HTML 富文本保真度高、复杂块表达力强，但 diff 噪声大、纯文本可读性差、Markdown 导出有损、XSS/sanitization 负担重。它适合“编辑器体验优先”，不适合“开放格式优先”。

### 1.4 同步、离线、冲突与版本历史

同步是**基于实体变更日志的双向增量同步**，核心在 `packages/trilium-core/src/services/sync.ts`、`sync_update.ts`、`entity_changes.ts`、`content_hash.ts`。

每次修改写 `entity_changes`：`entityName`、`entityId`、`hash`、`isErased`、`changeId`、`componentId`、`instanceId`、`isSynced`、`utcDateChanged`。`changeId` 保证幂等，`instanceId` 防止把变更回传给来源，`componentId` 让前端避免刷新正在编辑的 widget。

`sync()` 循环：登录（HMAC 时间戳 + syncVersion 校验）→ push（`isSynced=1 AND id > lastSyncedPush LIMIT 1000`）→ pull（按字节分批，桌面 32MB、移动 4MB/16MB，一个事务 apply 一批，预取下一批）→ 再 push → `syncFinished()` → 内容 hash 校验。`sync.ts` 用 `MAX_SYNC_ROUNDS=50` 防死循环，`MAX_SECTOR_RESYNC_ATTEMPTS=3` 防同一 sector 无限重试。

冲突是 **Last-Write-Wins**：`sync_update.ts` 比较 `utcDateChanged`，本地新则保留本地并让服务器更新，远端新则覆盖本地；没有三向合并，也没有冲突副本。文档明确说 “simple conflict resolution (without merge conflict indication)”（`docs/.../Synchronisation.md`）。未来时间的变更会被压到当前时间，避免时钟漂移造成永久胜出。删除用软删 + `isErased` 墓碑，防止旧客户端复活数据。

**内容 hash 修复**是最值得学的细节：`content_hash.ts` 按 `entityName` + `entityId` 首字符分 sector，聚合 SHA-1 后比对；用 `(count, maxId, syncedCount)` 做缓存指纹；发现分叉只重传坏 sector，并让服务器也 queue-sector。它处理了 blob 单边删除、迁移后 blobId 变化等数据库分叉场景。

**版本历史**：`BNote.saveRevision()` 按 `revisionSnapshotTimeInterval`（默认 600 秒）自动快照，支持 named revision、手动保存、恢复、删除、数量限制（`bnote.ts`、`docs/.../Note Revisions.md`）。恢复时先把当前内容存成新 revision，避免二次丢失。

**离线**：桌面版有本地 SQLite，完全离线；服务器版前端依赖服务器；移动 Web 离线弱。同步是全库双向复制，没有“只同步子树”的一等能力（hoisting 只是 UI 过滤）。

### 1.5 安全与隐私：单用户下的“保护会话”

- 登录密码用 **scrypt**（N=16384, r=8, p=1）派生 32 字节验证 hash 和加密 key（`services/encryption/scrypt.ts`、`password_encryption.ts`），constant-time compare。
- 受保护笔记有独立 protected session：密码派生 key 解密随机 `dataKey`，data key 只在内存，默认 10 分钟无操作清空（`protected_session.ts`）。
- 加密算法是 **AES-128-CBC**，随机 16 字节 IV，明文前加 4 字节 SHA-1 摘要，输出 base64(iv+ciphertext)（`data_encryption.ts`）。它不是 AEAD，完整性只有 32 位截断摘要，弱于 GCM/XChaCha20；但 key 是随机 data key，不直接由密码派生。
- 加密范围：protected note 的 title、content、revision、attachment 都加密；**metadata（结构、修改时间、属性）不加密**。这是刻意取舍：保留树、搜索元数据和同步效率，但泄露“有哪些笔记、何时改、标签是什么”。
- 认证支持密码、TOTP、OpenID Connect（`apps/server/src/routes/api/login.ts`、`services/auth.ts`、`services/encryption/totp_encryption.ts`、`services/open_id.ts`）；session 存 SQLite；CSRF 用 double-submit cookie；ETAPI token 只存 hash。
- 分享只支持 server 安装；分享 note 等于分享整个子树；用独立只读 SQLite 连接加载 `shaca` 缓存，只加载 share root 子树，并跳过 protected note 的附件（`share/shaca/shaca_loader.ts`、`share/sql.ts`）。分享可用 `#shareCredentials` 做简单密码保护；protected notes 不可分享。
- 最大风险面是脚本/自定义 widget/active content；官方用 safe import、CSP、DOMPurify、scripting guard 缓解，但“知识库可执行代码”本质扩大攻击面。

### 1.6 导入、导出与互操作

导入器在 `packages/trilium-core/src/services/import/`，支持 HTML、Markdown（单文件/zip 树）、OPML、Evernote ENEX、Notion zip、Google Keep Takeout、Anytype JSON、Obsidian vault、OneNote（Graph API）。导出 HTML、Markdown、OPML，以及带导航/样式的静态 HTML 站点（`export/zip/html.ts` 生成 navigation/index/style）。导入默认 `safeImport`，防外部脚本；单 item 上限约 374MiB，由同步协议决定（`Import & Export.md`）。策略是“多入口、少承诺”：入口覆盖主流应用，但导出到 Markdown/HTML 时复杂格式不可能完全保真。

### 1.7 UX/导航：空间 + 键盘的工作台

桌面三栏：左 note tree/launch bar，中 note，右 sidebar（outline、attributes、connections、AI chat）。值得借鉴的具体流程：

1. **树 + 多选 + 拖拽 + 克隆**：节点显示图标、颜色、badge；右键有克隆、移动、导出、导入、复制引用；多选可批量操作。
2. **Tabs + Split View**：每个 tab 可横向 split 成多个 note context；每个 split 有独立 hoisting；移动端最多两个、垂直排列（`docs/.../Split View.md`）。
3. **Hoisting**：把当前 note 当临时 root，隐藏父级/兄弟，搜索和 jump 也限定在子树（`Note Hoisting.md`）。比“展开文件夹”更符合深度工作。
4. **Workspaces**：在 hoisting 上加 `#workspace` 标签，把 Personal/Work 变成一键上下文，还可有自己的 inbox、calendar、template、search home（`Workspaces.md`）。实现是标签 + 子树过滤，成本低、价值高。
5. **Quick search / Jump to / Command palette**：Quick search 全文 + 200 字上下文预览 + 精确优先 + 结果不足 5 条时 fuzzy；Jump to 只搜标题，空输入显示 recent（Today/Yesterday/7 days/30 days），输入不存在的标题可直接创建；`>` 切命令面板（`Jump to & command palette.md`）。三者覆盖“空间记忆/关键词记忆/程序性记忆”。
6. **Launch Bar + Bookmarks**：可配置启动栏，支持拖拽 note、文件夹式 bookmark、`#bookmarkOpenMode`（currentTab/newTab/newSplit/newWindow/quickEdit）。
7. **移动端**：note tree 在 note 下方，左滑/返回露树；tab switcher 是全屏网格 + 预览；右栏变底部 sheet；文本工具栏在屏幕底部随键盘出现/隐藏（`Mobile Frontend.md`）。

### 1.8 规模与性能

- **Becca 全量内存缓存**：启动时把 notes/branches/attributes/options 全部读进内存，用位置数组批量读取，避免逐行分配对象（`becca_loader.ts`）。树遍历、搜索候选集极快，但内存随笔记数线性增长；适合单用户，不适合多租户。
- **Froca 懒加载**：前端只加载初始树，未知 noteId 被请求时才加载并连带父子 branch；删除的 note 留在缓存但没有 branch，用“branch 不存在”推断删除（`apps/client/src/services/froca.ts`）。
- **同步批量 + 预取**：pull 按字节分批、事务 apply、网络与 SQL 重叠；移动端 20MB blob 上限 + 可复用解码 buffer，避免 WebView OOM（`sync.ts`）。
- **搜索不是 FTS**：直接扫描 `notes JOIN blobs` 的 content（限制 2MB），加 Becca flat text 索引做标题/属性/路径匹配，先精确后 fuzzy（`search/expressions/note_content_fulltext.ts`、`note_flat_text.ts`）。无索引维护、语义可控，但 100k 笔记时全文搜索线性变慢，>2MB 内容不参与。
- schema 有 28 个索引，覆盖 title/type/日期/branch parent+position/attribute name+value/entity_changes isSynced 等常见查询。

### 1.9 NoteHack 对 Trilium 的采纳/改造/拒绝

**采纳**：树 + 显式边（branch）模型，即使 MVP 不做克隆也把“笔记”和“位置”分开；属性/标签 + 继承 + 保存搜索；hoisting/workspace；quick search + jump + command palette 统一入口；protected session（二次解锁门禁）；changeId 幂等 + tombstone + sector hash 修复；token API。理由是这些能力直接放大“个人知识库”的核心价值（复用、聚焦、快速找回、可自动化），且实现成本远低于协作/实时编辑。**改造**：HTML canonical 改为块级 JSON 或 Markdown 单真源 + 投影，避免双写；LWW 改为 base version + 自动合并 + 冲突副本；全量 Becca 改为分层缓存；移动 Web 改为本地 SQLite 离线优先。原因是 HTML 的导出/ diff 代价、LWW 的静默丢数据、全量缓存的内存上限、Web 移动端的离线短板都会在规模化后反噬。**拒绝**：单用户/无协作授权模型（若做团队会成为架构障碍）；无 FTS 的内容扫描；默认执行脚本/active content；vanilla widget + jQuery 的 UI 架构。拒绝的理由分别是：授权模型是 schema 级决策、后补代价极高；100k 笔记下扫描不可接受；脚本默认执行会把供应链风险变成默认风险；旧 UI 架构会拖慢新交互迭代。

---

## 二、Joplin

### 2.1 产品哲学：开放格式、自由选择、离线优先

Joplin 的 guiding principles 写在 `readme/about/principles.md`：Freedom of choice、Data privacy、Great usability、Reliability、Sustainability。产品上体现为：**Markdown 为 canonical format**（笔记本质是文本，富文本只是渲染层）；**offline first**（本地 SQLite 全量数据，同步是复制而非在线访问）；**同步目标可选**（Joplin Cloud、Nextcloud、WebDAV、Dropbox、OneDrive、S3、本地文件系统，`readme/apps/sync/index.md`）；**插件生态**；**开放/可退出**（JEX、raw、Markdown、HTML、PDF）。Trade-off：为了兼容任意文件型 target，同步必须保守、最终一致、以 item 为单位，带来延迟、冲突与小文件开销；Joplin Server 的 delta sync 才缓解。

### 2.2 数据模型：单父文件夹 + 多标签

初始 schema 在 `packages/lib/JoplinDatabase.ts`：

- `notes`：`id`、`parent_id`、`title`、`body`、`created_time`、`updated_time`、`is_conflict`、`is_todo`、`todo_due`、`todo_completed`、经纬度、`author`、`source_url`、`application_data`、`order`；migration 后加 `markup_language`（1 Markdown / 2 HTML）、`is_locked`、`share_id`、`deleted_time`。
- `folders`：`id`、`parent_id`、`title`，folder 可嵌套成 notebook tree。
- `tags` + `note_tags`：多对多，tag 全局。
- `resources`：附件元数据；`revisions`：历史 diff；`item_changes`：本地变更队列；`sync_items`：每个 item 在每个 sync target 的 `sync_time`、`remote_item_updated_time`、`base_body/base_title`；`deleted_items`：删除墓碑。

组织是**单父文件夹 + 多标签 + 保存搜索**。note 只有一个 `parent_id`，所以不支持“同一笔记出现在两个文件夹”；但 tag 可跨文件夹。这让树操作、拖拽、删除、权限非常简单，代价是复用弱于 Trilium 的 cloning。todo、source_url、经纬度、is_conflict、share_id 都是一等字段，说明 Joplin 把“待办/剪藏/冲突/共享”视为数据模型的一部分，而不是外挂。

### 2.3 编辑器：Markdown 真源 + 双编辑器

`packages/editor` 同时包含 CodeMirror（Markdown 源码）与 ProseMirror（富文本/预览相关）；桌面端再用 TinyMCE 做 WYSIWYG（`packages/app-desktop/gui/NoteEditor/NoteBody/TinyMCE/TinyMCE.tsx`）。Markdown 编辑器是 CodeMirror 6（可回退 5），支持 Vim/Emacs、搜索替换、插件、同步滚动。富文本编辑器编辑时把 HTML 转 Markdown 保存；官方明确列出限制：Markdown 插件不兼容、表格必须有 header、列表类型必须一致、HTML 格式可能丢失、reference link 转 inline link（`readme/apps/rich_text_editor.md`）。

双栏预览的同步滚动很精细：不是简单百分比，而是行号百分比 + DOM `source-line` 映射 + scrollmap 缓存 + 二分查找（`readme/dev/spec/sync_scroll.md`）。插件可注册 `editor` view 替换整个编辑区（`JoplinViewsEditor`）。

Trade-off：Markdown 真源让笔记永远可读、可 diff、可被其他工具处理，但富文本能力受 Markdown 表达力限制，TinyMCE round-trip 必然有损。Joplin 选择“宁可损失复杂格式，也不把用户锁进私有 JSON/HTML”。

### 2.4 同步、离线、冲突与版本历史

同步核心是 `packages/lib/Synchronizer.ts` + `BaseItem.ts` + `ItemChange.ts` + `file-api-*`。`SyncTarget` 描述目标，`FileApi` 只暴露 `list/put/get/delete/delta` 文件语义；每个 item 序列化成一个文件（笔记 `.md`，资源二进制），`info.json` 保存 sync target 级配置（E2EE、master key、PPK、min version）。`sync_items` 记录每个 item 在每个 target 的 `sync_time`，判断本地/远端谁更新。

流程：用户修改 → `ItemChange` 立即记录 → 几秒内上传（降低冲突窗口）→ 每隔几分钟轮询远端下载并 apply → 删除走 `deleted_items` 墓碑。Joplin Server 支持 delta：cursor 拉变更事件，事件压缩（create+update→create，update+delete→delete，create+delete→noop），cursor 失效则 full resync（`readme/dev/spec/server_delta_sync.md`）。附件默认“总是下载”，可配置手动/打开时下载；移动端对 >10MB 资源有保护（`readme/apps/attachments.md`）。

冲突：比较本地/远端 `updated_time`，双方都改则 `handleConflictAction`（`services/synchronizer/utils/handleConflictAction.ts`）。默认创建 **Conflict notebook**，把本地版本复制进去，用远端覆盖本地；用户可比较、复制、删除（`readme/apps/conflict.md`）。新版本支持**三向自动合并**：base 存在 `sync_items.base_body/base_title`，local/remote 做行级 diff3；只有双方改同一/相邻行才冲突；全部合并则不建 conflict note，部分冲突时两边都保留非冲突改动（`readme/dev/spec/conflict_auto_merge.md`、`services/conflict/autoMergeNote.ts`、`boundedDiff3.ts`）。加密 item 先在内存解密再合并；无法解密/锁定则退回普通 conflict note。非 note 冲突通常取远端，folder 冲突删除时 `deleteChildren: false` 防误删子树。

版本历史：所有客户端每 10 分钟为修改过的 note 保存 revision，同步到所有设备；revision 存 **diff patch** 而非全文，查看时从旧到新 apply（`models/Revision.ts` 的 `mergeDiffs`）。默认保留 90 天，可配置；由于 revision 同步，保留天数实际取所有设备最小值（`readme/apps/note_history.md`）。恢复不覆盖当前 note，而是复制到 “Restored Notes”。

### 2.5 安全与隐私：可选 E2EE + 本地明文 + 独立 note lock

Joplin 本地 DB 默认不加密，E2EE 主要保护同步目标。启用后 item 在 `serializeForSync` 时才加密，本地仍明文（`readme/apps/sync/e2ee.md`）。

加密算法演进：历史 SJCL（OCB2 已弃用；SJCL1a 是 AES-128-CCM，SJCL1b 是 AES-256-CCM）；新方法 `KeyV1`/`FileV1`/`StringV1` 用 native crypto，AES-256-GCM + PBKDF2-SHA512（master key 220,000 次；数据 3 次 + 每次随机 salt，因为 master key 已高强度），带 auth tag（`services/e2ee/EncryptionService.ts`、`crypto.ts`、`readme/dev/spec/e2ee/native_encryption.md`）。master key 是随机 256 字节，master password 只加密 master key；master key 加密后同步，服务器拿不到明文。加密数据是 ASCII 的 JED 包装，兼容 React Native 只能处理字符串的限制（`readme/dev/spec/e2ee/index.md`）。

共享 notebook 时生成 NOTEBOOK_KEY，用 sharer master password 加密；邀请时用 recipient 公钥重加密；recipient 用私钥解出后再用自己的 master password 加密。PPK 在同步时生成并存 `info.json`，避免多设备同时生成冲突（`readme/dev/spec/server_sharing_e2ee.md`、`e2ee/index.md`）。

Joplin Server 有账号、MFA、LDAP/SAML、brute-force limiter、session（`packages/server/src/utils/types.ts` 的 `LdapConfig`/`SamlConfig`、`readme/apps/mfa.md`）；支持共享 notebook（读/写权限）、发布 note 为公开链接；发布的 note 只带自己的资源，不自动分享被链接的 note（`readme/dev/spec/server_sharing.md`、`readme/apps/publish_note.md`）。

**Note Lock** 是独立于 E2EE 的 per-note 加密：用户设置 note lock 密码，生成单独 master key；锁定 note body 用该 key 加密，解锁会话只存内存；密码重置会轮换 key 并迁移已锁笔记（`services/noteLock/`）。这解决“设备已解锁但不想让人看到某篇笔记”的场景。

风险：本地明文意味着设备丢失即全泄露；E2EE 默认关闭意味着用户可能忘记开启。Joplin 用“可选 + 明确配置”换性能、搜索、插件兼容和低门槛。

### 2.6 导入、导出与互操作

导入：ENEX（Evernote，保留 metadata/资源/地理；HTML→Markdown 可能损失格式）、Markdown 文件/目录（保留目录结构为 notebook 树）、OneNote（在线/桌面导出）、JEX（Joplin 无损备份）、raw（目录形式）。导出：JEX（tar，含 notes/notebooks/tags/resources/metadata，可无损回导）、raw（一 item 一文件）、Markdown、HTML、PDF。插件可注册 importer/exporter（`JoplinInterop`），第三方格式不必进核心。官方原则明确说数据存 open format。Trade-off：JEX/raw 很开放，但 Joplin Markdown 有内部链接 `:/id`、资源链接、plugin fenced block 等方言；导出到其他工具需要转换，仍比私有 JSON 可迁移。

### 2.7 UX/导航：三栏 + Goto Anything + 透明同步状态

桌面三栏：左 sidebar（All notes / Notebooks / Tags / Shared / Trash）、中 note list、右 editor。具体流程：

1. **Sidebar**：笔记本树可拖拽嵌套，标签可拖到 note 上；同步按钮和同步报告在 sidebar 底部（`gui/Sidebar/Sidebar.tsx`、`FolderAndTagList`）。
2. **Note list 虚拟滚动**：`NoteList2.tsx` 用 `useVisibleRange` 只渲染可视行；支持 updated/created/title/custom 排序，todo 未完成置顶；每行显示标题、摘要、标签、pin、todo、附件、共享、冲突图标。这是大库体验关键。
3. **Goto Anything（Ctrl/Cmd+P）**：标题/正文跳转；`#` 接 tag、`@` 接 notebook、`:` 命令模式（`readme/apps/search.md`、`plugins/GotoAnything`）。和 Trilium Jump to 异曲同工。
4. **Note toolbar**：Markdown/Rich Text 切换、外部编辑、附件、note properties（i 图标）、previous versions、tags、分享/发布。Note properties 集中显示 created/updated、location、source URL、todo、公式等。
5. **冲突流程**：同步后侧边栏出现 Conflicts notebook；用户打开冲突 note，与原 note 对比、复制、删除。冲突显式建模，建立信任。
6. **Trash**：删除进 trash，恢复回原 notebook；原 notebook 不存在则回 root。
7. **Profiles**：File > Switch profile，多套配置/同步目标，共享语言/主题等全局设置（`readme/apps/profiles.md`）。
8. **Config screen**：左侧分类（General、Appearance、Editor、Markdown、Sync、Encryption、Note history、Plugins、MFA…），右侧表单；同步状态、日志、插件市场都在这里。
9. **移动端**：侧边栏抽屉、note list、editor 三屏；底部 toolbar；支持 share extension、相机、语音输入、富文本编辑。功能完整但配置少于桌面。

Joplin 的 UX 核心是**透明**：同步状态、冲突、历史、附件下载状态都可见，用户随时知道数据在哪、是否同步、有没有冲突。

### 2.8 规模与性能

- **SQLite FTS4 外部内容表**：`notes_fts` 是 `content="notes_normalized"` 的 FTS4 虚拟表，用 trigger 与 `notes`/`notes_normalized` 同步；支持 BM25、offsets、matchinfo（`JoplinDatabase.ts`、`services/search/SearchEngine.ts`）。加密/锁定/冲突 note 不进索引，解密后补索引。
- **CJK 回退**：SQLite FTS 对中日韩泰无词边界，检测到这些语言时切非 FTS 自定义搜索（`readme/apps/search.md`），务实妥协。
- **增量索引**：`item_changes` 驱动 `syncTables()`，只处理变化 note；初始索引分批 100 条；可 rebuild。
- **Note list 虚拟化**：只渲染可视行，大量笔记仍流畅。
- **附件懒加载**：`resource_local_states.fetch_status` + `resources_to_download` 控制下载；默认全下，移动端可手动/打开时下载（`models/Resource.ts`）。
- **同步增量/压缩**：Joplin Server delta cursor + 事件压缩；旧事件 180 天后压缩，cursor 失效 full resync。文件型 target 用 `basicDelta` 比较时间/大小。
- **Revision diff**：历史存 patch，减少存储和同步体积；重建时按链 apply。

### 2.9 NoteHack 对 Joplin 的采纳/改造/拒绝

**采纳**：Markdown/开放格式作为出口（Markdown/HTML/PDF/JSON 全量备份 + 可回导）；conflict copy + 三向自动合并；revision 以 diff 存储 + 定期快照 + 恢复不覆盖；Goto Anything 语法；note list 虚拟滚动；同步状态透明；插件进程隔离；note lock 独立密钥。理由是它们分别解决“可迁移/不丢数据/省空间/键盘效率/大库流畅/信任/供应链安全/二次门禁”八个真实痛点，且不要求改变核心数据模型。**改造**：E2EE 默认关闭改为默认开启/强提示，本地 DB 也加密；文件级同步改为数据库/HTTP delta 优先，WebDAV 只作备份；单父文件夹改为边表预留多父级；TinyMCE round-trip 改为块级编辑器；插件全量 Node 权限改为 manifest 权限。原因是 Joplin 的历史包袱（明文本地、文件 mtime、Markdown 富文本限制、插件权限过宽）会在 NoteHack 的目标场景里放大。**拒绝**：本地明文数据库；“冲突笔记本”作为唯一冲突 UX（改专用 Conflicts 视图 + 自动合并 + 批量清理）；过度桌面优先的配置复杂度；以文件时间戳作为同步正确性基础（应服务端版本号/游标）。拒绝理由是：设备丢失是现实威胁；冲突笔记本长期会污染组织；配置复杂度会把普通用户挡在门外；文件时间不可靠会导致漏同步/重复冲突。

---

## 三、Standard Notes

### 3.1 产品哲学：协议优先、零知识、长期主义

Standard Notes 定位 “end-to-end encrypted note-taking app for digitalists and professionals”，强调 longevity、sustainability、privacy。README 关键词是 E2EE、cross-platform、self-host、longevity；mobile README 甚至引用 Longevity Statement 说“adding new features is something we prefer not to do”。这不是普通极简，而是**把数据寿命置于功能数量之上**。

关键决策：**协议优先**——SNJS 把认证、密钥、加密、同步、存储抽成共享库，客户端只做 UI；`packages/snjs/specification.md` 用 v004 描述密钥层级、加密流程、存储模式、密码迁移。**服务器零知识**——只存加密 payload 和公开 key params，永不持有 root key 的 master half。**强制 E2EE**——账号数据默认全加密，没有“关 E2EE 同步明文”的选项；本地存储也加密。**可替换编辑器**——native Plain/Super + iframe Markdown/Code/Spreadsheet/Authenticator + 第三方。**订阅 + 开源自托管**——核心 AGPL，托管收费，历史/文件/共享 vault 与订阅绑定。

### 3.2 数据模型：一切皆 item，关系用 references

SN 没有 notes/folders/tags 表，而是把一切同步对象抽象成 item/payload：note、tag、file、smart view、component、user prefs、items key、vault listing、trusted contact 都是不同 `content_type` 的 item。每个 item 有 `uuid`、`content_type`、`content`、`references`、时间戳、`deleted`/`dirty` 等；关系不是 join 表，而是 `references` 数组（note→tag、tag→parent tag）。

- **Tag 即文件夹**：`SNTag` 有 `title`、`parentId`（通过 `isTagToParentTagReference` 找父 tag）、`noteReferences`、`noteCount`；tag 可嵌套，标题用 `.` 分隔（`TagFolderDelimitter`），也可 parent reference 嵌套。一个 note 可属多个 tag，所以“文件夹”和“标签”在模型上是同一个东西。
- **Smart View**：不是真实文件夹，而是 `predicate`（谓词 JSON）。内置 Notes、Files、Starred、Archived、Trash、Untagged、Conflicts；用户可建自定义 smart view（`SmartView.ts`、`SmartViewBuilder.ts`）。这是 SN 版“保存搜索”。
- **Vault**：`VaultListing` 带 `systemIdentifier`、`rootKeyParams`、`keyStorageMode`、`sharing`。Vault 不是文件夹，而是独立密钥系统；每个 vault 有自己的 key system root key，vault 内 item 的 `key_system_identifier` 指向它。个人/共享 vault 同一模型，shared vault 通过非对称密钥交换共享。
- **File 是一等 item**：文件不是 note 附件字段，而是独立 `FileItem`，通过 references 关联；内容加密存储，支持大文件分片上传。

优势是统一：同步、加密、冲突、权限、历史都只处理一种对象，新类型不改表。代价是关系查询要靠内存索引、删除/引用完整性靠应用层、大库内存压力大。

### 3.3 编辑器：可替换编辑器 + Lexical Super Note

note 上存 `noteType` 和 `editorIdentifier` 决定编辑器：`NoteType` 有 Authentication、Code、Markdown、RichText、Spreadsheet、Task、Plain、Super、Unknown（`packages/features/src/Domain/Component/NoteType.ts`）；native editors 是 Plain/Super（`NativeEditors.ts`）；iframe editors 是 Authenticator/Spreadsheet（`IframeEditors.ts`）；第三方通过 component 注册。选择逻辑在 `EditorForNoteUseCase`：先 noteType，再 editorIdentifier，再第三方 component association，最后回退 Plain（`ComponentManager/UseCase/EditorForNote.ts`）。

内容格式：Plain/Code/Markdown 的 `note.text` 是纯文本/Markdown/代码；Super 是 Lexical 块编辑器的 JSON 字符串，支持 block、embed、file、link、表格、代码块、Markdown 预览（`packages/web/src/javascripts/Components/SuperEditor/`，`@lexical/*` 0.49）；导出用 Lexical Markdown exporter 转 Markdown/HTML/PDF。导入时对 note 有 3MB、文件 50MB 阈值（`Importer.ts`）。

插件安全模型：第三方 editor 是 iframe，`sandbox` 含 `allow-scripts`、`allow-popups`、`allow-forms`、`allow-modals`、`allow-downloads`，但**不含 `allow-same-origin`**，origin 是 `null`，无法直接访问父页面 DOM/cookie（`IframeFeatureView.tsx`）。父应用与 iframe 用 `postMessage`；`ComponentViewer` 做权限校验，组件必须声明 `permissions`（`stream-items`、`stream-context-item`、`save-items`、`create-item`、`delete-items`、`themes` 等），每次读写走 `runWithPermissionsUseCase`（`ComponentAction.ts`、`ComponentViewer.ts`）。组件有 `sessionKey`、只读模式、锁定 item 过滤，父应用移除 private properties。代价是 iframe 启动延迟、焦点/快捷键/剪贴板集成难做，原生感弱于 Trilium/Joplin。

### 3.4 同步、离线、冲突与版本历史

同步是**基于 item 的增量同步 + 服务端冲突检测**（`packages/snjs/lib/Services/Sync/`）：`SyncService` 维护 `syncToken` 和 `paginationToken`；`AccountSyncOperation` 每批最多 150 个 item，循环到 pending 为空。客户端把 dirty item 加密，POST `/v1/items`；服务器返回 `retrieved_items`、`saved_items`、`conflicts`、`shared_vaults`、`messages`。`ServerSyncResponseResolver` 把响应拆成 retrieved/saved/conflicts/rejected 几个 delta；`ConflictDelta` 按 item 类型选策略。`SyncMode.DownloadFirst` 首次登录先下载再允许本地写，`downloadFirstSync` 最多重试 5 次。离线模式 `OfflineSyncOperation` 只把本地 payload 标记 saved，不访问服务器，在线后真正同步。

冲突：服务器发现同一 item 的 `updated_at_timestamp` 与上传 base 不一致时返回 `sync_conflict`，带 `server_item`/`unsaved_item`。`ConflictStrategy` 有 `KeepBase`、`KeepApply`、`KeepBaseDuplicateApply`、`DuplicateBaseKeepApply`、`KeepBaseMergeRefs`（`models/.../Conflict.ts`）。默认 note 冲突保留本地为副本、应用远端，即生成 conflict note；用户在 `NoteConflictResolutionModal` 对比多版本、选择保留、删除/回收（`Components/NoteView/NoteConflictResolutionModal/`）。`ItemsKey`、`Component`、`VaultListing` 等有各自策略（key 用 KeepBase，vault 比较 key 时间戳），说明冲突策略按内容类型可编程。无法解密时根据 base/apply 哪边 errored 选择保留 + 复制另一边，避免丢数据。

版本历史：服务器端保存 item revisions（`/v1/items/:uuid/revisions`），`RevisionManager` 拉列表/单条/删除；UI `RevisionHistoryModal` 分 Remote/Session/Legacy（`Controllers/NoteHistory/NoteHistoryController.ts`）。客户端 `HistoryManager` 还维护会话内历史，按 item 记录，超过 20 条时优化：保留最旧、最新、显著变更（delta >25 字符），大段删除时保留前一条（`Services/History/HistoryManager.ts`）。服务器 revision 频率/保留策略由服务端配置（README 的 `SYNCING_SERVER_REVISIONS_FREQUENCY` 可见）。离线时本地加密 payload 可读写，dirty item 排队；但所有 item 在内存解密，大库内存压力大。

### 3.5 安全与隐私：Argon2id + XChaCha20-Poly1305 + 密钥层级

SN 的 v004 协议是三家最现代、最系统的：

- **Root key**：密码 + identifier + server salt seed → **Argon2id**（`ArgonIterations: 5`、`ArgonMemLimit: 64MB`、输出 64 字节）；分成 `masterKey` 和 `serverPassword`。服务器只收到 serverPassword，永远不知道 masterKey（`specification.md`、`DeriveRootKey.ts`、`Algorithm.ts`）。
- **Items key**：随机生成，用 root key master half 加密；每个协议版本一个。改密码只重加密 items keys，不重加密所有笔记。
- **Per-item key**：每个 item 加密时随机生成 `item_key`，用 items key 加密成 `enc_item_key`；内容用 `item_key` 加密。单篇笔记 key 可独立轮换/共享，`items_key_id` 让解密方知道用哪把 key。
- **算法**：XChaCha20-Poly1305（`Operator004.getEncryptionDisplayName()`），nonce 24 字节，AAD 含 `u`（uuid）、`v`（版本）、可选 `ksi`（key system id）、`svu`（shared vault uuid）；加密字符串格式 `004:nonce:ciphertext:authData:additionalData`（`GenerateEncryptedProtocolString.ts`、`GenerateAuthenticatedData.ts`）。
- **Root key wrapping**：本地 passcode 派生 rootKeyWrappingKey，加密 root key 后存本地；有 keychain 时 root key 存 keychain，无 keychain 时存 wrapped root key。解锁不是比对 hash，而是“能否解密”（`specification.md` 的 Root Key Wrapping）。
- **本地存储加密**：有账号时 value storage/payload storage 都用 root key 加密；payload 加密存 IndexedDB（web）/SQLite（mobile）；root key 存 keychain 或 wrapped。应用锁/生物识别是另一层 UI 门禁（`DiskStorageService.ts`、`ProtectionService.ts`）。
- **Protected notes**：SN 的 `protected` 是 **UI 级保护**，不是额外加密——所有 note 本来就 E2EE；`ProtectionService` 要求重新验证 passcode/biometric 才能查看 protected item，并有时长限制（`ProtectionSessionDurations.ts`）。产品文案必须说清楚，避免误解。
- **认证**：密码派生 root key，服务器用 serverPassword 验证；支持 MFA（TOTP/U2F，`packages/snjs/lib/Services/Mfa/MfaService.ts`）、session 管理、read-only session；`strict sign in` 防恶意服务器降级协议版本（`specification.md` Authentication）。
- **共享 vault**：每个 shared vault 有独立 key system root key；邀请用非对称加密（`crypto_box`，X25519 + XSalsa20-Poly1305）传 vault key，消息带签名防中间人（`AsymmetricEncrypt.ts`、`AsymmetricMessageService`、`ProcessAcceptedVaultInvite`）。
- **发布**：Listed 是独立服务，用户显式 `authorizeNoteForListed` 后才能发布；发布前过 `ProtectionService.authorizeListedPublishing()`（`ListedService.ts`），不是“分享链接即公开”。

Trade-off：密钥层级优雅，但实现复杂；协议版本、key recovery、root key 变更、shared vault 权限、MFA、passcode 交互有大量边界条件。安全默认强，但忘记密码无法恢复，这是刻意。

### 3.6 导入、导出与互操作

导入在 `packages/ui-services/src/Import/`：Plaintext、HTML、Evernote、Google Keep、Simplenote、Aegis（Authenticator）、Super（JSON）、通用 Markdown；`Importer.ts` 按 MIME/扩展名 + 内容校验自动识别；文件上限 50MB，单 note 3MB。导出：单 note 按编辑器 `fileType` 导 txt/md/html/json/pdf；Super 支持 JSON/Markdown/HTML/PDF，Markdown 可选 frontmatter，嵌入文件可选 inline/reference/separate。全库备份分**加密备份**（`CreateEncryptedBackupFile`，保留 keyParams/items keys）与**解密备份**（`CreateDecryptedBackupFile`，排除 items keys），都是 JSON，可回导。Listed 可发公开博客，支持自定义域名（付费）。SN 不追求导入所有格式，而是保证数据能完整导出；加密/解密双轨保证“公司消失也能拿走数据”。

### 3.7 UX/导航：三栏 + Smart Views + Vault 切换

Web/Desktop 布局：

- **左栏 Navigation**：Smart Views（Notes、Files、Starred、Archived、Trash、Untagged、Conflicts）+ Tags/Folders 树 + 底部账户/设置；tag 可展开/折叠、拖拽嵌套、右键菜单、搜索。
- **中栏 Item List**：当前 tag/smart view 的 note/file 列表；顶部搜索 + filter（protected/archived/trashed、tag filter、title only）；排序；无限滚动（按容器高度算 pageSize，`ItemListController`）；多选工具栏；Floating Add Button。
- **右栏 Editor**：title、editor、note status（saving/saved/error/waiting）、pin、linked items、change editor、protected overlay、conflict banner、revision history 入口。
- **移动端**：`PaneLayout` 把三栏折叠成 `TagSelection → ItemSelection → Editing` 单屏导航，Android back 逐级返回（`ResponsivePaneProvider.tsx`）；移动端是 WebView 包 native 壳（`packages/mobile/src/MobileWebApp.tsx`），数据库/钥匙串是 native 的。
- **Command Palette**：Tab 分 All/Commands/Notes/Files/Tags，模糊匹配、快捷键提示、高亮匹配片段（`CommandPalette.tsx`）。
- **Focus Mode**：隐藏侧栏/列表，只留编辑器。
- **Change Editor**：每篇 note 可切 Plain/Markdown/Super/第三方，note 存 `editorIdentifier`；切换时提示重格式化风险（`DoesEditorChangeRequireAlert.ts`）。
- **Revision History**：Modal 左侧版本列表（Remote/Session/Legacy），右侧预览/diff，底部恢复/删除；移动端 List/Content 两个 tab。
- **Conflict Resolution**：Modal 列当前 note + 所有 conflict 版本，可多选、预览/diff、选择“保留选中，其余移 trash/永久删除”，显示冲突来源/更新时间（`NoteConflictResolutionModal.tsx`）。
- **Vault Switcher**：切换个人/共享 vault；共享 vault 显示成员/权限；只读成员看到 EditingDisabledBanner。
- **Listed**：note 菜单发布到 Listed，选择 author/blog，生成公开 URL，发布状态可见。

SN 的 UX 核心是“一切围绕 item 列表 + 可替换编辑器”：导航是过滤器（tag/smart view），列表是工作队列，编辑器是详情。它没有 Trilium hoisting/split，也没有 Joplin notebook 树那么强的空间感；用 smart view + tag 树提供轻量组织。

### 3.8 规模与性能

- **内存 payload collection**：`ItemManager`/`PayloadManager` 持有所有解密 item；`ItemDisplayController` 在内存 filter+sort，增量更新 `sortedItems`（`models/.../ItemDisplayController.ts`）。UI 响应快，但内存线性增长。
- **客户端搜索 O(n)**：`itemMatchesQuery` 对每个 item title/text 做 `indexOf`，支持多词 AND、引号短语、UUID 精确匹配（`SearchUtilities.ts`）。无 FTS，几千条够用，十万条明显慢。
- **分页/无限滚动**：按容器高度算 pageSize，`renderedItems = items.slice(0, notesToDisplay)`，滚动到底 `paginate()` 增加 pageSize（`ItemListController.ts`）。不是虚拟列表，大量 DOM 仍有压力。
- **同步批量 150**：`SyncUpDownLimit=150`，每批一个 HTTP 请求，循环到 pending 空。
- **本地加密存储**：payload 加密存 IndexedDB/SQLite，读写需解密/加密，CPU 成本高于明文 SQLite；用 native crypto（libsodium）和批量 split 降低开销。
- **revision/shared vault 分离**：revision 不占本地主存储；shared vault 按 vault key 加密，避免全库重加密。
- **导入限制**：50MB 文件、3MB note，防单条 payload 过大。

Trade-off：SN 适合“中等规模、强安全、简单查询”的个人库；不是为 100k 笔记或团队实时协作设计，瓶颈在全量内存 + 线性搜索。

### 3.9 NoteHack 对 Standard Notes 的采纳/改造/拒绝

**采纳**：协议优先的密钥层级（root key → items key → per-item key）；Argon2id + XChaCha20-Poly1305 + AAD；本地存储加密 + root key wrapping/passcode；按内容类型定制冲突策略；冲突解决 Modal + diff；iframe 沙箱 + 权限清单；Smart View + tag 树 + Vault；加密/解密备份双轨。理由是它们把“长期安全 + 可迁移 + 可扩展”做成架构属性，而不是后期补丁；尤其密钥层级让改密码、分享、轮换都不会退化成全库重加密。**改造**：全量内存 + O(n) 搜索改为分层缓存 + FTS；iframe 编辑器改为沙箱 Worker/原生块编辑器 + 插件扩展点；订阅门禁改核心功能开源（E2EE、历史、导出、基础共享开源，托管/团队/大文件付费）；多协议版本改单版本 + 一次性迁移；“Protected” 明确区分 UI 门禁与加密，或提供真正 per-note key。原因是 SN 的强安全伴随高内存/低搜索性能/高实现复杂度，直接照搬会让 NoteHack 在大库和移动端吃亏。**拒绝**：把极简当拒绝基础功能（tag-only、有限搜索、无 hoisting/split 会流失重度用户）；所有 item 常驻内存；完全依赖服务端冲突检测；复杂订阅功能矩阵割裂自托管体验。拒绝理由是：极简应是默认路径而非能力上限；内存模型决定规模上限；离线/自托管场景需要客户端预判；功能矩阵会破坏“开源可信”的叙事。

---

## 四、跨项目综合：共同点与背后的“为什么”

### 4.1 本地优先 + SQLite：同步是“复制”，不是“在线访问”

三家都把主数据放本地 SQLite（Trilium/Joplin 用 better-sqlite3，SN mobile SQLite/Web IndexedDB），同步只是复制。原因：延迟（打开/搜索/编辑不能走网络）、离线（地铁/飞机/弱网）、数据所有权（服务器挂了本地还在）、冲突可控（本地是真相副本，可检测/合并/保留副本）。这也解释了为什么三家都不是纯 Web SaaS：纯在线无法满足笔记的可靠性预期。

### 4.2 UUID + 变更日志/游标 + 墓碑

三家都用 UUID 做 item 身份，用“变更日志 + 单调游标”做增量同步：Trilium 用 `entity_changes.id` + `lastSyncedPull/Push` + `changeId` + `isErased`；Joplin 用 `item_changes.id` + `sync_items.sync_time` + `deleted_items` + server delta cursor；SN 用 `updated_at_timestamp` + `syncToken`/`paginationToken` + `deleted` + server conflict map。为什么必须这样：离线创建需要客户端 UUID；网络重试需要幂等；同步中断需要断点续传；删除需要墓碑防复活；冲突检测需要知道“基于哪个版本修改”。

### 4.3 树是“关系”，标签是“跨切面”

Trilium 用 `branches` 边表（多父级/克隆）；Joplin 用 `notes.parent_id` 单父级 + `note_tags` 多对多；SN 用 `references` 数组（note→tag、tag→parent tag）。人类既需要空间记忆（“它在哪个树位置”），又需要关联记忆（“它属于哪些主题”）。只做文件夹限制复用，只做标签失去“放在哪里”的直觉。共同点是：**不要把组织方式硬编码成单一字段**，用边/引用表才能加克隆、共享、智能视图。

### 4.4 E2EE 的密钥层级，而不是“一把钥匙加密全库”

Trilium：password → scrypt → password-derived key → 解密 random data key → AES-128-CBC。Joplin：master password → master key（随机 256B）→ 加密 notes/resources；master key 加密后同步；分享用 notebook key + PPK。SN：password → Argon2id → root key（master + serverPassword）→ items key → per-item key → content。分层的原因：改密码只重加密 keys（O(1) 而非 O(n)）；分享单篇/单库只包裹对应 key；多设备/密钥恢复可独立；服务器零知识。NoteHack 最应直接采用这部分；SN 的 Argon2id + XChaCha20-Poly1305 是现代基线，Trilium 的 AES-CBC 和 Joplin 的 SJCL 是历史包袱。

### 4.5 冲突策略没有完美解，只有把选择显式化

| 项目 | 策略 | 优点 | 代价 |
|---|---|---|---|
| Trilium | LWW（`utcDateChanged`） | 简单、快、无冲突 UI | 静默丢数据；时钟敏感 |
| Joplin | Conflict copy + 三向自动合并 | 不丢数据；多数冲突自动解决；用户可见 | 冲突笔记本累积；合并边界（行级、5000 行/1s） |
| SN | 服务端检测 + 按类型策略 + 冲突副本 + Modal | 精细、可编程、UI 集中 | 依赖服务端；复杂；离线预判弱 |

三家都不约而同保留冲突副本而不是阻塞同步：阻塞会让用户无法工作；自动合并只覆盖非重叠编辑；真实冲突必须让人判断；保留副本是唯一“不丢数据”的默认。NoteHack 最佳组合：base version + 自动合并（块级/行级）+ 冲突副本 + 集中 Conflicts 视图。

### 4.6 编辑器与存储解耦，内容格式是产品战略

Trilium note type→widget/HTML；Joplin Markdown 真源/CodeMirror+TinyMCE；SN noteType/editorIdentifier→native/iframe editor。解耦原因：内容类型多样；插件生态需要稳定接口；导入导出取决于格式；同步/加密/压缩越简单越好。格式选择是战略：HTML 保真最高、可移植/可 diff 最差；Markdown 可移植/可读最好、富文本最弱；块级 JSON 富文本最好、可移植依赖导出器。NoteHack 若兼顾，建议块级 JSON 为真源 + Markdown/HTML 投影/导出，但只允许一个可编辑真源。

### 4.7 插件必须隔离，权限必须显式

Trilium 脚本/widget 强但默认执行外部代码风险高（safe import/scripting guard 缓解，本质信任用户脚本）；Joplin 插件在独立 BrowserWindow/进程，sandbox proxy + IPC，但 API 能力大、权限弱；SN iframe 无 same-origin + 显式 `ComponentAction` 权限 + 逐次校验，安全性最好但体验/性能成本最高。隔离原因：笔记应用持有最敏感数据，插件是最大供应链攻击面；插件崩溃/死循环不能拖垮主应用；跨平台需要不同 runner。NoteHack 应采用最小权限 + 进程/沙箱隔离 + manifest。

### 4.8 导入/导出是“信任基础设施”

Trilium 支持 HTML/Markdown/OPML/ENEX/Notion/Keep/Anytype/Obsidian/OneNote；Joplin 支持 ENEX/Markdown/OneNote/JEX/raw/HTML/PDF；SN 支持 Plaintext/HTML/Evernote/Keep/Simplenote/Aegis/Super + 加密/解密备份 + 单 note 多格式。原因：降低迁移成本（敢用因为能走）、建立信任（开放格式=不绑架）、生态互操作、长期保存（笔记要用几十年）。NoteHack 应把“完整导出、可回导、开放格式”作为 v1 硬指标。

### 4.9 性能是分层设计，不是单点优化

四层：元数据缓存（Trilium Becca 全量、Joplin SQLite+虚拟列表、SN 内存 collection）；正文懒加载（Froca、附件懒下载、SN 按需解密但偏全量）；列表分页/虚拟化（Joplin `useVisibleRange`、SN `notesToDisplay`、Trilium 搜索 limit 200）；同步批量化（Trilium 32MB/4MB、Joplin 100/150 条、SN 150 条；事务/压缩减少 round trip）。笔记应用瓶颈不是 CPU，而是首屏、搜索、滚动、同步四个交互；没有一种策略适合所有规模，应按目标最大库规模选择。

### 4.10 UX 三件套：树、搜索、命令面板

Trilium note tree + quick search + Jump/command palette；Joplin notebook tree + FTS/Goto Anything；SN tag tree + search/filter + Command Palette。树利用空间记忆（知道在哪），搜索利用关键词记忆（忘了在哪），命令面板利用程序性记忆（不离开键盘）。三者不是替代，而是覆盖不同回忆路径；NoteHack 应做成同一快捷入口的不同模式（`>` 命令、`#` 标签、`@` 位置），降低学习成本。

---

### 4.11 由综合推导出的 NoteHack 取舍

把上面的共同点落到 NoteHack，建议如下：

1. **存储**：SQLite + WAL；`notes`、`note_parents`（边表，默认单父，预留多父）、`tags`、`note_tags`、`attributes`、`revisions`、`blobs`、`attachments`、`change_log`、`sync_state`、`conflicts`；UUID 主键；内容进 `blobs`，metadata 轻量。
2. **内容**：富文本用块级 JSON（Lexical/ProseMirror）为真源，块 ID 稳定；纯文本/代码原样；导出 Markdown/HTML/PDF/JSON；只允许一个可编辑真源，避免双写。
3. **同步**：自研增量协议（change_log + 服务端 cursor + 幂等 changeId）；按 entity+sector 做 hash 校验，坏 sector 重传；base version + 三向合并 + 冲突副本 + 集中 Conflicts 视图；tombstone + 定期 full resync（可断点续传）。v1 不做 CRDT/实时协同。
4. **安全**：Argon2id 派生 root key；root key → user items key → per-note key；XChaCha20-Poly1305 + AAD（uuid/version/vault id）；本地库加密（SQLCipher 或 OS keychain 包裹 DB key）；passcode/biometric 作为 UI 门禁；per-note lock 独立 key；共享 vault 用非对称密钥交换；公开链接必须显式授权。
5. **UX**：桌面三栏 + 移动单屏栈；树 + 标签 + 保存搜索；hoisting/workspace；quick search + jump + command palette 统一入口；note list 虚拟化 + 多排序 + 过滤；同步状态透明；version history（diff + 定期快照 + 恢复不覆盖）；change editor 但默认只暴露 2-3 个。
6. **性能**：FTS5 外部内容表 + 增量索引；元数据缓存 + 正文懒加载；列表虚拟化/分页；同步批量 + 压缩 + 事务；索引/缩略图/OCR/AI 放后台 worker。
7. **互操作**：Markdown/HTML/ENEX 导入；Markdown/HTML/PDF/JSON 全量备份（可回导）；插件 manifest 权限 + 沙箱；ETAPI 风格 token API。
8. **v1 明确不做**：多用户实时协同/CRDT；全功能插件市场；所有格式无损导入；默认执行脚本；纯 Web 在线架构。

**三家的一句话教训**：Trilium 证明结构自由度是知识库护城河，但要用 change log、sector hash、hoisting/workspace 驯服复杂度，弱点是搜索索引、协作模型、HTML 可移植性；Joplin 证明开放格式和透明冲突处理能建立长期信任，离线优先 + 可选同步目标是大规模采用关键，弱点是本地明文、文件级同步延迟、Markdown 富文本天花板；Standard Notes 证明加密协议可以成为产品核心，密钥层级、零知识服务器、沙箱编辑器可以同时做到，但强安全不能成为弱体验/弱规模的借口，弱点是全量内存、O(n) 搜索、订阅门禁。

因此，NoteHack 最稳的路线不是“选一家抄”，而是：**Trilium 的结构与专注 UX + Joplin 的开放格式与冲突透明 + Standard Notes 的密钥层级与沙箱扩展**，再用现代 FTS、懒加载、增量同步，做成一个既能处理 10 万笔记、又能让普通用户 5 分钟上手的产品。这也解释了三家共同点的本质：它们都不是在解决“怎么存文本”，而是在解决“如何在不可靠网络、不可信服务器、不断增长的笔记量和长期可迁移性之间，建立一套用户敢把一生笔记交出去的信任结构”。
