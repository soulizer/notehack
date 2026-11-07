# SilverBullet、Memos、Blinko 深度对比：三种“笔记”的技术路线

> 研究对象：`silverbulletmd/silverbullet`（commit `01d6b0e`）、`usememos/memos`（commit `88a20fe`）、`blinkospace/blinko`（commit `a1c71e6`）。
> 阅读范围包括 README、`docs/`、数据模型、编辑器、同步/离线、认证与分享、导入导出、UX 与性能相关源码。文中路径均相对于各仓库根目录。未启动三个服务做端到端复现，结论以源码和仓库内设计文档为准；涉及具体版本行为时以对应 commit 为准。

## 0. 结论先行

这三个项目都在解决“自托管、数据属于自己、Markdown 笔记”这一组需求，但给出了三种不同的答案：

- **SilverBullet 把笔记当作“磁盘上的文件”**：Markdown 文件是唯一真相源，客户端是一个可编程的知识库运行时，服务端尽量退化成文件存储、认证、合并与搜索。
- **Memos 把笔记当作“时间线上的独立资源”**：一条 memo 是带作者、可见性、位置和标签的 API 资源，服务端是权威，界面围绕快速记录和个人时间线组织。
- **Blinko 把笔记当作“卡片与 AI 上下文”**：强调快速捕捉、卡片墙、复习、三类笔记和 RAG 问答，功能面最宽，但一致性与安全设计也最粗糙。

一句话概括它们的架构取向：**SilverBullet 是 local-first 的文件系统，Memos 是 server-authoritative 的资源 API，Blinko 是 feature-rich 的在线卡片应用**。NoteHack 若想兼具“快速记录”和“长期知识库”，最合理的路线是吸收 SilverBullet 的本地优先与合并模型、Memos 的资源/权限/导出纪律，以及 Blinko 的捕捉与复习 UX，而不是复制其中任何一家的全部取舍。

---

## 1. SilverBullet

### 1.1 核心哲学、定位与关键取舍

SilverBullet 的自我定位是 “Programmable, Private, Browser-based, Open Source, Self Hosted, Personal Knowledge Database”，具体形态是“浏览器里的 Markdown 编辑器 + wiki 链接 + 内置数据库/查询语言 + Space Lua 脚本环境”（`README.md`）。它最重要的哲学不是“提供一个笔记应用”，而是“**让你的笔记变成一个可编程系统**”。

支撑这一哲学的第一原则是：**Space 就是磁盘上的一个文件夹，文件是 source of truth**。文档明确说 Space 在实践上“就是一个目录”，用户可以用任何工具备份、操作、版本控制这些文件（`docs/Space.md`）。这带来几个直接后果：

1. **应用不是数据的所有者**。外部编辑器、脚本、coding agent、Git 都可以同时修改同一批文件。
2. **索引是派生的**。Object Index 可以从 Markdown 文件重建（`docs/Object.md`、`docs/Object Index.md`），因此数据库不是权威，文件才是。
3. **服务端很薄**。服务端负责文件访问、认证、并发修改的 reconcile、搜索和 Git revisions，而编辑、索引、查询、脚本执行主要发生在客户端（`docs/Architecture.md`、`docs/Architecture/Server.md`）。

代价也很明确：

- **可编程性换来信任边界**。任何有 `write` 权限的人都能写 Space Lua，而这段脚本会在后来打开该 Space 的人（包括管理员）浏览器里执行。SilverBullet 在 `docs/Security.md` 里把这一点说得很直白：`write` 不只是“能改文件”，而是“能以其他成员身份行动”。因此它没有“能编辑但不能写脚本”的中间角色，推荐的隔离方式是“一个不可信写入者一个 hostname”。
- **没有 CRDT**。为了容纳“文件可能被任何工具改”的现实，它选择文件监听 + 三方合并，而不是 Google Docs 式的实时协同。`docs/Collaboration.md` 明确说经典 CRDT 协同在这种前提下“很棘手”。
- **每个客户端保存一份完整副本并各自建索引**。离线能力很强，但冷启动、存储和索引成本都落在客户端（`docs/ADR/001 Offline-First PWA.md`）。

这套取舍适合“个人/小团队、愿意写脚本、重视文件可迁移性”的场景；不适合“多租户、强隔离、零信任协作”的场景。

### 1.2 数据模型与组织方式

SilverBullet 的数据模型可以概括为三层：

**第一层：Space 中的文件。** 一个 Space 至少包含 `index.md` 和 `CONFIG.md`，可以有普通 Page、Meta Page、Document（图片、PDF 等非 Markdown 文件）和文件夹（`docs/Space.md`、`docs/Page.md`）。Page 的名字相当自由，允许 `/`，但不能包含 `|`、`@`、`#`、`[[`、`]]` 等（`docs/Names.md`）。名字既像标题又像路径，作者被鼓励使用 Title Case 和扁平命名空间（`docs/Names.md`）。

**第二层：Markdown 语法与链接。** 内容格式是 CommonMark 加扩展（`docs/Markdown.md`）。内部链接支持 `[[page]]`、`[[page|alias]]`、标题锚点 `#heading`、行列锚点 `@L12C42`、字符偏移 `@123`，以及 `![[...]]` transclusion（`docs/Link.md`）。链接解析先做精确路径匹配，再做大小写不敏感的“名称/路径后缀”匹配；有多个候选时标记为 ambiguous，并在编辑器中提示选择（`docs/Link.md`）。这实现了“链接不依赖 Space 根目录位置”的可移植性，但也让重命名和歧义处理变成持续成本。

**第三层：Object Index 与关系图。** SilverBullet 把所有 Markdown 结构抽取为 Object：`page`、`task`、`header`、`item`、`paragraph`、`table`、`data`、`document`，每个对象有 root tag、user tags、itags 和 `ref`（`docs/Object.md`、`docs/Tag.md`）。链接、mention 和类型化属性被索引成 `relation` 边，因此 Graph View 可以按结构而不是按文件名浏览（`docs/Graph View.md`）。Backlink 不是单独存储的字段，而是对 relation index 的查询结果（`docs/Linked Mention.md`）。

**Frontmatter** 是页面级 YAML 元数据，支持 `tags`、`aliases`、`displayName` 以及任意属性；可以用 JSON Schema 校验 tag 字段和配置（`docs/Frontmatter.md`、`docs/Schema.md`）。这相当于把“文件系统 + Markdown AST”变成了一个可查询的半结构化数据库，但数据库本身随时可以从文件重建。

这种模型的优点是极强的可移植性和可解释性：任何对象都能追溯到文件中的位置，任何索引损坏都能重建。缺点是：**没有稳定的内部 ID**，页面身份就是路径/名字，重命名需要重写链接；标签和链接是语法层的事实，而不是数据库约束；复杂查询依赖客户端索引，第一次打开大 Space 会有明显冷启动。

### 1.3 编辑器架构与内容格式

SilverBullet 的编辑器是 **CodeMirror 6 + Preact**（`README.md`）。它没有采用“源码/预览”双栏，而是 Live Preview：在可编辑页面中，Markdown 标记在光标不进入时被渲染为格式化文本，光标进入或 Alt-click 时才显示源码（`docs/Live Preview.md`）。实现上依赖 Lezer 语法树和 CodeMirror decoration，例如 wiki link 的隐藏/替换逻辑在 `client/codemirror/syntax/wiki_link.ts`，渲染管线在 `client/markdown_renderer/markdown_render.ts`。

内容格式仍然是普通 `.md` 文件。扩展包括 wiki link、hashtag、task、frontmatter、`${...}` 表达式、transclusion、anchor 等；`${...}` 会在 Live Preview 中求值并渲染为 Markdown、表格或交互 widget（`docs/Space Lua.md`）。Space Lua 可以定义全局函数、命令、页面模板和 widget；`space-lua` 代码块在全 Space 生效，`page-lua` 只在当前页生效。脚本有 busy-time 预算，超时可停止并隔离（quarantine），避免一个脚本卡死整个编辑器（`docs/Space Lua.md`）。

扩展机制有两层：

- **Plugs**：运行在 Web Worker 中的沙箱代码，可以注册命令、快捷键、事件、后台任务，通过 syscall 与主应用通信（`docs/Plugs.md`）。
- **Libraries**：以 Meta Page 形式分发的一组 Space Lua、模板、widget、样式和可选 plug；通过 Share 机制 pull/update（`docs/Library.md`）。

文档编辑器则把非 Markdown 文件交给专用 editor：5 MiB 以内的文本文件复用 CodeMirror，图片/PDF/音视频走内置 viewer 或外部插件（`docs/Document Editor.md`）。

这套编辑器的核心优势是“**编辑体验与文件格式不分裂**”：你看到的是渲染结果，保存的仍是 Markdown。代价是 Live Preview 的 decoration 逻辑复杂，动态 widget/查询会引入渲染成本和索引依赖；而且它不是块编辑器，结构化能力主要靠语法和索引，而不是数据库字段。

### 1.4 同步/离线模型、冲突处理与版本

SilverBullet 是三者中唯一真正实现“多设备离线编辑 + 自动合并”的项目。

**离线架构。** 浏览器端是 PWA，Service Worker 为每个 Space URL scope 注册一次；它缓存客户端代码、在 IndexedDB 中保存 Space 文件副本，并**拦截发往服务端的 HTTP API**，在本地实现同一套文件 API（`docs/Architecture/Service Worker.md`、`docs/ADR/001 Offline-First PWA.md`）。因此离线时读、写、查询、索引都能工作。Document（非 Markdown 文件）默认不同步，需要 `config.set("sync.documents", true)`；可以用 gitignore 语法设置 `sync.ignore`（`docs/Sync.md`）。

**同步算法。** 客户端维护 `SyncSnapshot`：

- `files`: path → `[本地 lastModified, 远端 lastModified]`
- `remoteHashes`: 上次同步时远端 revision 的 SHA-256
- `baseHashes`: 上次双方一致的内容 hash，用于三方合并

这些结构在 `client/spaces/sync.ts`。同步时先比较时间戳判断哪一侧变化；远端写入/删除用 ETag 条件请求（`If-Match` / `If-None-Match`）保护（`docs/HTTP API.md`）。如果双方都改了，客户端把 base、proposed 和远端当前 revision 发给服务端的三方合并端点；能合就合，不能合就写成 Git 风格冲突标记，编辑器再把冲突段渲染成 “edit conflict” widget（`docs/Collaboration.md`、`client/spaces/sync.ts`）。二进制或超过 1 MiB 的文件不合并，而是生成 `name.conflicted-<hash>.ext` 副本。

**删除与编辑的冲突规则**尤其值得学习：如果一方删除、另一方编辑，SilverBullet 选择“编辑获胜”，抑制删除并提示用户，而不是静默丢失内容（`docs/Collaboration.md`、`client/spaces/sync.ts`）。如果拉取过程中本地又发生变化，它会放弃这次 pull、重新排队，避免覆盖新编辑；如果时间戳相同但内容不同（同毫秒写入），会用记录的内容 hash 再判定一次。这些细节说明作者认真处理了“时间戳不可靠”的边界。

**性能控制。** 同步并发为 5，快照写入被限制为约每 2 秒一次，避免首次同步大 Space 时快照序列化变成二次复杂度（`client/spaces/sync.ts`、`client/service_worker/sync_engine.ts`）。保存节流约 2 秒；实时连接健康时扫描间隔 60 秒，否则 20 秒；dirty queue 会合并重复路径。

**版本。** SilverBullet 用 Git 做 revisions：Managed 模式自动初始化仓库并提交，默认“安静约 30 秒后提交、最长 5 分钟一次”，提交作者区分账号、SilverBullet、External；Unmanaged 模式只读既有仓库；还可以 fetch/merge/push 远端（`docs/Revisions.md`）。这把“版本历史”外包给了最成熟的工具，同时保持文件可迁移。

**客户端加密。** 针对“不可信设备”而不是“不可信服务器”：登录时用 PBKDF2 从用户名/密码派生 256-bit key，key 只存在 Service Worker 内存；IndexedDB 的 key 用 AES-CTR（固定 counter 以保证确定性），value 用 AES-GCM（随机 IV）。关闭所有标签页即丢失 key，需要重新登录。文档明确说这不是 E2E，服务端磁盘是否加密取决于部署（`docs/Client Encryption.md`）。这是一个很聪明的威胁模型切分。

### 1.5 安全与隐私：认证、加密、分享、API token

SilverBullet 默认是多 Space 模式：账号由管理员创建或通过 Google Workspace/Pocket ID/OIDC 登录；每个 Space 对访客有 `none/read/write`，成员有 `read/write`，管理员额外拥有 dashboard 和所有 Space 的 write（`docs/Authentication.md`、`docs/Security.md`）。单 Space 模式仍支持 `SB_USER=username:password`，但被标记为 legacy。

关键安全事实：

- **write 等于代码执行权**。`docs/Security.md` 明确列出 capability endpoints：`/.shell`（默认关闭）、`/.proxy`（服务端网络代理）、`/.runtime`（headless Chrome 执行 Lua），全部要求 write。
- **隔离靠 origin**。对“不可信写入者”的推荐部署是“每个 Space 一个 hostname”，这样某个 Space 里的脚本无法读取另一个 Space 的 session cookie；path binding 共用 hostname 只适合完全信任的圈子（`docs/Security Profiles.md`）。
- **公开分享是整 Space 只读**。Dashboard 可以把 Space 的匿名访问设为 Read，访客得到完整客户端、导航、查询，但不能编辑或访问 capability endpoint；还可以 freeze 整个 Space（`docs/Publishing.md`）。
- **API 认证**支持 session cookie/JWT 与 Bearer token；多 Space 模式下 API token 通过 Dashboard 发放（`docs/Authentication.md`、`docs/HTTP API.md`）。
- **MCP** 使用 OAuth：RFC 9728 资源元数据、RFC 8414 授权服务器元数据、RFC 7591 动态客户端注册、PKCE、refresh token rotation，API token 被明确拒绝（`docs/HTTP API.md`）。
- **客户端加密**只保护本地 IndexedDB，不保护传输和服务端；传输必须靠 TLS（`docs/Client Encryption.md`）。
- **零遥测**：服务端和 Web 客户端不发送使用数据或内容，只有用户主动配置的外部请求（`docs/Zero Tracking.md`）。

这套模型的优点是“信任边界清晰、可部署性极强”；缺点是“没有细粒度页面 ACL”。一旦你让某人 write，他能改整个 Space，也能写会在别人浏览器里运行的代码。对 NoteHack 来说，如果要做多人分享，必须把“脚本/插件执行”与“普通编辑”分成不同权限，否则会重复 SilverBullet 的安全债。

### 1.6 导入/导出与互操作性

SilverBullet 的互操作策略是“**文件格式就是接口**”，而不是“发明一个归档格式”：

- **备份/迁移**：直接复制 Space 文件夹，或用 Git、Dropbox、Syncthing 等同步（`docs/Space.md`、`docs/Desktop Sync.md`）。
- **导出**：`Export: Page Or Selection` 支持复制 rich text 或 clean Markdown；clean 模式会剥离 SilverBullet 特有语法并烘焙 `${...}`，得到可粘贴到 GitHub/其他编辑器的 Markdown（`docs/Export.md`）。
- **Share**：通过 frontmatter 的 `share.uri`、`share.mode`（push/pull/sync）、`share.transform` 与外部位置同步；支持 GitHub 文件、Gist、另一个 SilverBullet space；pull/sync 会把上次协商的 `share.hash` 写回页面，因此状态跟着页面走，不依赖设备（`docs/Share.md`）。
- **发布**：整 Space 公开只读，可作为网站；官方文档站本身就是 SilverBullet Space（`docs/Publishing.md`）。
- **Library**：通过 pull 安装/更新库，Shared Pages 视图显示每个页面的同步状态（`docs/Shared Pages.md`）。

优点是“没有任何锁定，退出成本极低”；缺点是“没有统一的整库归档格式”，元数据（如 revisions、分享状态、客户端配置）不在一个可移植包里；跨工具迁移时，SilverBullet 特有语法要么退化成源码，要么需要 bake/transform。

### 1.7 UX/导航模式中值得借鉴的部分

SilverBullet 是三者中最“键盘优先、命令驱动”的：

- **Page Picker（Cmd/Ctrl-K）**：按最近活动排序；输入 `#tag` 过滤标签，输入 `$` 切到 anchor 导航；`Shift-Enter` 精确创建页面；Space 键智能补全当前文件夹或 emoji（`docs/Page Picker.md`）。
- **Command Palette**：同一套 picker 交互，显示快捷键，按最近使用、priority、名称排序（`docs/Command Palette.md`）。
- **Meta Picker**：把实现性页面（脚本、模板、库）与内容页面分开。
- **Search**：Pages/Meta/All 三个 segment，All words / Exact phrase / Semantic 三种模式；结果带高亮摘要（`docs/Search.md`）。
- **Backlinks**：每个页面底部自动显示 Linked Mentions，附来源行摘要；`${...}` 在摘要里不会执行，避免副作用（`docs/Linked Mention.md`）。
- **Graph View**：Local/Global 两个 tab，ghost node 点击展开，边标签表示 relation kind，支持按 tag/relation 过滤（`docs/Graph View.md`）。
- **Workbench**：Overview/Data/Code/Libraries/Maintenance/Console，把查询、脚本、库、冲突、lint 都放在一个可检查的面板里（`docs/Workbench.md`）。
- **Live Preview 的 source reveal**：光标进入才显示标记，Alt-click 显式显示；只读页面也能看源码但不能编辑（`docs/Live Preview.md`）。
- **任务与 transclusion**：task 是索引对象，可跨页查询；transclusion 让同一段内容出现在多个页面（`docs/Task.md`、`docs/Link.md`）。
- **文件树**作为传统导航的补充，支持 All/Pages/Documents/Meta 分段（`docs/File Tree.md`）。

这些模式的共同点是“**让检索和跳转不离开键盘**”，并且把“内容/元内容/命令/数据”分成不同 picker。NoteHack 如果要服务重度用户，这一套比卡片墙更值得投入。

### 1.8 规模与性能技术

SilverBullet 的性能设计分布在三层：

**客户端索引。** Object Index 用消息队列增量处理文件变化，支持索引版本号、全量重建、初始索引进度、缺失文件重排队；索引完成才 reload editor state（`client/data/object_index.ts`）。索引按 tag 存储对象，支持 metatable、aggregate、query；`plugs/index/indexer.ts` 负责把 Markdown AST 拆成 page/task/header/item/relation 等对象。它明确接受“索引异步滞后几秒”，查询可能读到旧结果（`docs/Object Index.md`）。

**服务端搜索。** 服务端维护独立的全文索引（`server-search/`），与客户端 Object Index 是两套系统（`docs/Architecture.md`、`docs/Search.md`）。全文索引支持语言相关分词/归一化、1 MiB/页上限、增量追赶、索引构建状态；语义搜索在服务端本地跑 embedding 模型（Granite 97M 约 220 MB 下载/490 MB 内存，E5-small 约 488 MB/590 MB），默认只对 ≤5000 页的 Space 开放，超过需显式 opt-in（`docs/Search.md`）。这把 AI/语义能力放在服务端，避免把内容发给第三方。

**同步与文件层。** 同步并发 5、快照写入节流、ETag 条件写、只在需要时做内容 hash、dirty queue 去重、首次同步按 `.plug.js` 优先排序（避免插件晚到导致索引逻辑没生效），都是针对大 Space 的工程优化（`client/spaces/sync.ts`、`client/service_worker/sync_engine.ts`）。服务端搜索和 revisions 都是可选/按 Space 配置，避免所有部署都承担成本。

潜在瓶颈：每个客户端一份完整副本、每个客户端一套索引、Live Preview 的动态 widget、首次索引的分钟级冷启动、以及“脚本在主线程上跑”的模型。SilverBullet 用时间预算和 quarantine 缓解脚本问题，但没有改变“客户端重”的根本取舍。

### 1.9 NoteHack 应该 adopt / adapt / reject 什么

| 决策 | 内容 | 理由 |
|---|---|---|
| **Adopt** | 文件/Markdown 作为 source of truth，索引可重建 | 最低锁定、最强可迁移性；导出/备份/Git 都自然成立 |
| **Adopt** | ETag 条件写 + base snapshot + 三方合并 + 删除/编辑规则 | 在多设备离线场景下，这是比“最后写入获胜”更可靠的工程基线 |
| **Adopt** | Page Picker / Command Palette / Meta Picker 的分层检索 | 重度用户的导航效率远高于纯卡片流 |
| **Adopt** | Object Index 式的派生对象模型（page/task/link/tag/relation） | 让 Markdown 具备数据库查询能力，同时不破坏文件格式 |
| **Adopt** | `share.uri/mode/hash` 这种“分享状态跟着内容走”的设计 | 不需要中心化分享表，跨设备/跨服务器可复现 |
| **Adapt** | Space Lua 的可编程性 | NoteHack 若多人使用，应把脚本放进受限沙箱/插件权限，而不是让 write 直接等于代码执行 |
| **Adapt** | 每 Space 一个 hostname 的隔离 | 可作为企业/多租户部署选项，但普通个人部署不必强制 |
| **Adapt** | 全量本地副本 | 对小 Space 很好；大 Space 应支持按需/分层缓存，而不是无条件全量 |
| **Reject** | “write 即信任”的单一权限模型 | 只要存在共享，就必须有“可编辑但不能执行脚本/插件”的角色 |
| **Reject** | 无 CRDT 就宣称实时协同 | 三方合并适合异步；若 NoteHack 要做同页实时协作，应单独引入 CRDT/OT，而不是假装合并能覆盖所有场景 |
| **Reject** | 依赖 Git 作为唯一 revision 后端 | Git 很强，但不是所有用户都愿意维护仓库；应提供内置轻量版本历史，Git 作为可选后端 |

---

## 2. Memos

### 2.1 核心哲学、定位与关键取舍

Memos 的定位非常克制：“Simple note-taking for your everyday thoughts.” 它把笔记还原为一条条 **memo**，围绕“个人时间线”组织，而不是页面树或知识图谱（`README.md`）。三个核心承诺是：日常快速书写、按时间回看、数据留在自己的服务器；第四个是“分享由你控制”，包括私密、分享给朋友、公开发布，以及 Space 内协作（`README.md`）。

技术上，Memos 是典型的 **server-authoritative 单二进制应用**：

- 后端 Go 1.27，`net/http` + Connect RPC + gRPC-Gateway + Protocol Buffers；
- 前端 React 19 + Vite + Tailwind + `@usememos/ui`；
- 存储支持 SQLite/MySQL/PostgreSQL；
- 生成 Go/OpenAPI/TypeScript 客户端；
- 代码分层严格：`cmd → server → core → store → {provider, markdown, filter} → internal`（`AGENTS.md`、`memos/CONTEXT.md`）。

这套架构的取舍是：**用服务端权威换取简单、一致、易运维**。它没有 SilverBullet 的离线同步，也没有 Blinko 的 AI 全家桶；换来的是清晰的资源模型、严格的权限策略、可预测的数据库行为、以及一个可以塞进单个 Docker 容器的部署。

Memos 的“极简”不是功能少，而是**概念少**：没有文件夹、没有 wiki link、没有块引用、没有实时协同、没有客户端数据库。它把复杂度集中在“memo 资源 + 标签 + 时间线 + 可见性 + Space”这几个概念上。

### 2.2 数据模型与组织方式

Memos 的核心表非常小（`store/migration/sqlite/LATEST.sql`）：

- `memo(id, uid, creator_id, created_ts, updated_ts, row_status, content, visibility, pinned, payload, space_id)`
- `memo_relation(memo_id, related_memo_id, type)`，type 为 `COMMENT | REFERENCE`
- `attachment`、`reaction`、`memo_share`、`space`、`space_member`、`user`、`user_setting` 等

`payload` 是 JSON，保存从 Markdown 派生的 `tags`、`property`（has_link/has_task_list/has_code/has_incomplete_tasks/title/has_inline_image）和 `location`（`proto/store/memo.proto`）。标签不是独立表，而是从内容中提取后写进 payload；层级通过 `/` 表示，并存储隐含祖先（`filter/README.md`）。

**Memo 是独立资源**：`memos/{uid}` 是 API 身份，UID 稳定，作者拥有它。评论不是附属行，而是“另一个 memo + 一条不可变 COMMENT relation”；评论有自己的作者、可见性、位置和生命周期（`docs/design/multi-spaces.md`、`proto/api/memo_service.proto`）。这带来一个很重要的设计原则：**关系不传递授权，每个端点独立鉴权**。

**Space 是协作边界，不是租户**。这是 Memos 设计文档里最值得读的部分（`docs/design/multi-spaces.md`）：

- 一条 memo 的 placement 是“未分配或恰好一个 Space”；
- audience 是独立的 `PRIVATE/PROTECTED/PUBLIC/SPACE`；
- authorship、placement、audience、distribution、relation context 互不推导；
- Space 成员分 `ADMIN/USER`，邀请必须被接受才生效；
- Space admin 不能编辑别人的单条 memo，也不能改变其 placement；Space 删除会级联删除直接分配的 memo，但不跟随 relation；
- 应用管理员是“命名 memo 操作”的 superuser，但列表/feed 仍然套用普通 audience 谓词，避免管理员在信息流里看到别人的私密 memo。

这套模型的价值在于：它把“**内容归属**”“**可见性**”“**协作位置**”“**分发**”拆成独立维度，避免了 Slack/Notion 式“把 memo 移进 Space 就自动改变权限”的隐含耦合。NoteHack 如果要做“个人 + 共享空间”，这是比“文件夹即权限”更好的起点。

组织方式上，Memos 依赖：

- **时间线**：默认按 `create_time desc`，Home 是个人 feed，Explore 是混合 feed；
- **标签**：`#tag` 或 `tags:` frontmatter，支持层级、过滤、标签树；
- **Saved Views**：用户自定义 CEL 过滤器，保存为命名视图（`proto/api/user_service.proto`）；
- **Calendar / Map / Attachments / Inbox**：从 memo 的时间、location、附件派生出的不同浏览面；
- **搜索**：`content.contains/startsWith/endsWith/matches` 通过 CEL 编译成 SQL LIKE/正则，没有独立全文索引（`filter/README.md`）。

它的组织哲学是“**扁平内容 + 多视图**”：不建树，用标签、时间、位置和查询来切面。

### 2.3 编辑器架构与内容格式

Memos 的编辑器是三者中“产品化程度最高”的之一。前端只有一个 `MemoEditor` 组件，统一处理 view/edit/compose/comment 四种形态（`web/src/components/MemoEditor/README.md`）。它基于 `@usememos/editor` 的块编辑器，**存储格式仍是标准 Markdown**；关键承诺是：用户没有编辑过的块按字节原样保存，编辑过的块才按规范化风格重写（`web/src/components/MemoEditor/README.md`）。

架构分层：

- `MemoEditor`：memo 级组件，负责 name/draft seed、mode、data、draft store、mutations；
- `MemoContentView`：只读表面，负责导航、anchor、link card、搜索高亮；
- `MemoMarkdown`：把编辑器绑定到 memos 的方言、主题、标签/mention 装饰、HTML sanitize、URL policy；
- `EditSession`：编辑表面，负责 chrome、上传、音频、建议、保存；
- `Editor`：实际编辑器 + 组件扩展 + `EditorController` 契约。

数据流也很有参考价值：

- **读按 name**：`useMemoByName` 从任何已持有的 query（列表、评论页、日历月、详情、分享）返回最新副本；列表里的卡片不额外请求，跟随列表刷新（`web/src/components/MemoEditor/README.md`）。
- **写是 mutation**：`useUpdateMemo/useCreateMemo` 会 patch 并刷新所有持有该 memo 的 query，保存后所有出现位置立刻更新。
- **草稿是 UI state，按身份键控**：`edit:<name>`、`comment:<parent>`、`new:<scope>[:<space>]`；新身份就是新 session；编辑已有 memo 不持久化草稿（`web/src/components/MemoEditor/README.md`）。
- **保存前校验 + 上传**：`useMemoSave` 先上传本地文件，再调用 `memoService.save`；失败时已上传的附件留在 draft，重试不重复上传。
- **代码分割**：编辑器是独立 chunk，首次编辑/撰写时加载；Home 预加载 `preloadMemoEditing()`，避免布局跳动。

Markdown 解析在 Go 侧：`markdown/` 包负责 AST、memos 语法扩展（tags、mentions、math、GFM）、渲染和派生 payload（`markdown/doc.go`）。`core/memopayload` 在内容变化时重建 tags/property，并用 `Version` 做一次性 backfill（`core/memopayload/runner.go`）。这保证“内容派生数据”不会因为解析器升级而长期失真。

内容格式是标准 Markdown，没有 SilverBullet 的 `${...}` 可执行表达式，也没有 Blinko 的卡片类型字段（类型在 memo 外部）。这使 Memos 的内容最“干净”，但也最不支持“文档即应用”。

### 2.4 同步/离线模型、冲突处理与版本

Memos 是明确的 **online-only** 产品：

- Web 端没有注册 Service Worker，也没有离线数据层；`web/index.html` 只有 `site.webmanifest`，代码库中没有 `navigator.serviceWorker`/Workbox（`web/` 全局搜索可证）。
- 数据获取靠 React Query 缓存；列表用 `useInfiniteMemos` + 滚动加载（`web/src/components/PagedMemoList/PagedMemoList.tsx`）。
- 实时刷新靠 SSE：服务端 `/api/sse` 推送 `memo.changed` / `space.changed`，事件**不携带资源名、audience、actor**，客户端收到后 invalidate 对应 query 再按普通授权重新拉取（`server/api/sse_handler.go`、`server/api/sse_hub.go`、`docs/design/multi-spaces.md`）。
- 多标签页用 Web Locks 选 leader，只让一个 tab 建 SSE 连接，再通过 `BroadcastChannel` 分发事件；隐藏 30 秒后断开，避免后台浪费（`web/src/hooks/useLiveMemoRefresh.ts`）。
- 草稿在浏览器本地保存（MemoEditor draft store），所以“没点保存就关页面”不会丢；但已保存 memo 的离线编辑、离线删除、离线评论都不支持。

冲突处理：Memos 的 `UpdateMemo` 用 field mask 做部分更新，但没有 `If-Match`/版本号/expected revision；并发写入是**最后提交获胜**（`server/api/memo_service.go` 的 UpdateMemo 路径）。没有 per-memo revision history；只有 `ARCHIVED` 生命周期状态，导出格式也明确不保留 revision（`docs/design/memos-export-format.md`）。因此它不是“多设备协作编辑器”，而是“多个客户端读写同一份服务端状态”的 CRUD 应用。

版本/备份策略主要靠：

- 数据库备份（SQLite 单文件/MySQL/Postgres dump）；
- Memos Export Format 的个人归档；
- 附件存储（本地/S3）。

这是一种非常务实的选择：**不承诺离线，就不需要同步引擎、冲突 UI、版本向量和 tombstone**。代价是移动端弱网体验差、无法在飞机上写长文、多人同时编辑同一 memo 会静默覆盖。

### 2.5 安全与隐私：认证、加密、分享、API token

Memos 的安全设计是三者中最系统化的。

**认证。**

- 用户名/密码用 bcrypt（`core/user/user.go`、`server/api/auth_service.go`）。
- 登录返回 15 分钟 JWT access token；access token 带 `auth_hash`，由 userID + 当前 password hash + server secret 做 HMAC，改密码会立即使旧 access token 失效（`server/auth/token.go`、`server/auth/authenticator.go`）。
- Refresh token 30 天，放在 HttpOnly cookie，服务端存 token 记录并轮换，可撤销（`proto/api/auth_service.proto`、`server/auth/authenticator.go`）。
- PAT 以 `memos_pat_` 开头，32 位随机串，服务端只存 SHA-256 hash，可设过期时间（`server/auth/token.go`、`server/auth/authenticator.go`）。
- 支持 OIDC SSO（PKCE），没有内置 TOTP 2FA（代码库中无实现）。

**授权。**

- 所有传输（Connect、gRPC-Gateway、MCP）共享一个 `Authorizer`，统一做认证 + method-level ACL；公开方法在 `server/api/acl_config.go` 中显式列出（`server/api/authz.go`、`AGENTS.md`）。
- Memo 读权限是 fail-closed 的共享策略：未知 visibility 拒绝；`PRIVATE` 仅作者；`PROTECTED` 登录用户；`PUBLIC` 登录用户 + 允许匿名时匿名；`SPACE` 仅活跃 Space 成员；share token 只对 exact memo 生效（`core/access/memo.go`）。
- 管理员在“命名 memo 操作”上是 superuser，但列表/feed 仍套 audience 谓词；归档用户无条件拒绝；Space 邀请不算成员（`core/access/memo.go`、`docs/design/multi-spaces.md`）。
- 分享是 capability：`memo_share` 用 22 字符 shortuuid（约 122-bit 熵），可设过期时间，只对一条 memo 生效，`SPACE` memo 禁止创建分享（`server/api/memo_share_service.go`）。

**滥用防护。**

- 进程内 sliding-window rate limiter，默认开启；覆盖匿名/登录总预算、登录 IP/账号、注册、link metadata、上传、转写、写操作、导出/导入；批量请求按 item 数计费；失败登录才计数，成功后退款；limiter 内存满时 fail-open（`docs/design/api-abuse-controls.md`）。
- 客户端 IP 由 trusted-proxies 解析，默认信任 private 网段；禁止直接相信 `X-Forwarded-For`（`docs/design/api-abuse-controls.md`）。
- 错误契约遵循 AIP-193：`RESOURCE_EXHAUSTED` + `ErrorInfo.reason` + `RetryInfo`/`Retry-After`/`RateLimit` 头。

**文件与内容。**

- 非公开附件使用 `private, no-store`；上传会重新嗅探 media type、剥离 EXIF、限制大小；支持本地/S3；导出流式写出、限制并发、路径穿越整包拒绝、解压炸弹边界（`docs/design/memos-export-format.md`、`server/fileserver/`）。
- Webhook 有签名和 SSRF 防护（`internal/webhook/`、`AGENTS.md`）。
- AI 只有语音转写（`proto/api/ai_service.proto`、`provider/README.md`），没有把笔记内容默认发给 LLM；这降低了隐私面。

**隐私边界。** 没有 E2E 加密，服务端能看到全部内容；隐私依赖自托管 + 磁盘加密 + TLS。对于“自托管个人/小团队”，这是合理取舍；对于“托管多租户”，需要额外的静态加密和密钥管理。

### 2.6 导入/导出与互操作性

Memos 的导出格式是三者中最工程化、最值得抄的。

**Memos Export Format 1.0**（`docs/design/memos-export-format.md`）：

- 普通 ZIP，`manifest.json` 首 entry 自描述 `format: memos-export`、`formatVersion`、generator、exportTime、scope、counts；
- `memos/<uid>.json` 使用 proto3 JSON 映射，字段包括 uid、creator、create/updateTime、state、visibility、pinned、contentPath、tags（信息性）、location、space、parent、relations、attachments、reactions；
- `memos/<uid>.md` 是 memo 内容的**逐字节原文**，不加 frontmatter、不改链接、不追加换行；
- `attachments/<uid>/<filename>` 存附件字节；
- 记录使用 JSON Schema 2020-12 作为 normative schema；容器规则、路径安全、ZIP64、压缩方法、时间戳都有明确规定；
- 导入是 idempotent 的：以 UID 为键，重复导入同一归档得到同一状态；冲突策略 `SKIP/REPLACE/DUPLICATE`；先 validate 再写；父评论先于子评论；附件重新嗅探 MIME、剥离 EXIF、限制大小；
- 版本策略：minor 只加可选字段/entry/enum，reader 忽略未知字段；major 才允许破坏性变化；每个版本有 golden archive 和 CI 回归。

**导出/导入传输**：导出已从 RPC 改为管理员可调用的文件路由 `GET /file/users/{username}/export`，流式写 ZIP，单实例同时只允许一个导出，`HEAD` 做预检；导入是分块上传，先 `validate_only` 返回 plan，再按冲突策略提交（`docs/design/memos-export-format.md` 的 Amendments）。这解决了“大附件把服务端内存打爆”的问题。

**互操作**：格式明确只保证 Memos → Memos，不作为通用笔记交换格式；但内容文件是 Markdown，附件是原始字节，因此“人工可读、可迁移”仍然成立。外围集成有 Web Clipper、Telegram bot、REST/Connect API、MCP server（`README.md`、`server/mcp/README.md`）。

优点是“**可验证、可重复、可流式、可演进**”；缺点是“**不与其他产品互操作**”。NoteHack 应该 adopt 这个容器的纪律，但把 schema 设计成更通用的 Note 模型，并额外提供 Markdown 文件夹导入/导出。

### 2.7 UX/导航模式中值得借鉴的部分

Memos 的 UX 核心是“**打开就能写，写完就在时间线上**”：

- **Home**：顶部常驻 composer，下面是个人时间线；显示 creator/visibility/space/pinned 状态；空状态引导欢迎页（`web/src/pages/Home.tsx`）。
- **Explore**：混合作者 feed，仍按时间排序；pinned 只在单一作者 feed 中生效，避免混合 feed 被置顶打乱（`web/src/pages/Home.tsx`）。
- **Spaces**：Space 切换器 + Space 内 Home/Explore/Calendar/Map/Attachments；归档、Inbox、用户资料保持 user-global（`docs/design/multi-spaces.md`、`web/src/router/index.tsx`）。
- **Tags**：层级标签树，展开状态按 scope 持久化；每个标签显示计数（`web/src/components/TagTree.tsx`）。
- **Saved Views**：用户用 CEL 写过滤器，界面提供大量示例（pinned、recent、public、project tags、untagged、archive tree、unassigned、open tasks、has image、regex、year、weekend、long content 等），还能 `validate_only` 先校验再保存（`web/src/pages/MemoViews.tsx`）。
- **Calendar / Map / Attachments / Inbox**：同一批 memo 的不同切面；附件库分 media/audio/documents/unused。
- **列表体验**：无限滚动 + 接近底部自动加载；内容不足一屏时自动继续拉取；支持单列/多列 grid、compact 模式；滚动位置恢复（`web/src/components/PagedMemoList/PagedMemoList.tsx`）。
- **Quick Find**：侧边栏搜索按当前路由决定 scope（route-collection / user-collection / all），日历/附件搜索会跳到同 collection 的 Home（`web/src/components/AppSidebar/routes.ts`）。
- **设计系统**：`@usememos/ui` + Tailwind v4 token，统一 `mu-*` 工具类；空状态、错误、加载 skeleton 都有明确规范（`AGENTS.md`）。

Memos 的 UX 值得学的是“**降低记录摩擦 + 用视图而不是文件夹来组织**”。它不追求 SilverBullet 的键盘全覆盖，但 Home 的 composer、标签树、Saved Views、Calendar/Map 这些切面，对“日常记录型”用户非常高效。

### 2.8 规模与性能技术

Memos 的性能策略是“**把查询压到数据库，把状态留在服务端**”：

- **CEL → SQL 编译器**：`filter/` 把 CEL 解析成 IR，再按 SQLite/MySQL/Postgres 方言渲染，支持 JSON 字段、时间、标签集合、字符串匹配、正则、时间 accessor、`now`/`duration` 常量折叠；所有字段有 schema，不能注入任意 SQL（`filter/README.md`）。
- **索引**：memo 有 `creator_id`、`space_id,row_status,created_ts DESC,id DESC`；relation 有 `related_memo_id,type,memo_id`；attachment 有 `creator_id`；migration 26.10 为 usage count/sum 加索引（`store/migration/sqlite/LATEST.sql`、`docs/design/user-usage-limits.md`）。
- **分页**：page token 内部是 `limit + offset`（`proto/api/common.proto`），默认 50、最大 1000；深分页会随 offset 变慢，这是它相对 SilverBullet/现代 keyset 分页的弱点。
- **缓存**：进程内 TTL cache（默认 10 分钟、最多 1000 项），用于 user/setting 等读多写少数据；不是分布式缓存，重启即失效（`store/cache/cache.go`）。
- **SSE**：一个 hub 向所有已认证客户端广播，事件只有类型；慢客户端会被 unsubscribe，避免阻塞（`server/api/sse_hub.go`）。
- **前端**：React Query 按 key 缓存，memo 读按 name 复用已有 query；编辑器独立 chunk + 预加载；无限滚动 + 自动补页；列表/网格按宽度切换（`web/src/components/MemoEditor/README.md`、`web/src/components/PagedMemoList/PagedMemoList.tsx`）。
- **后台任务**：payload backfill 按 version 批量 100 条重建，可中断重试，写时带并发编辑保护（`core/memopayload/runner.go`）。
- **多数据库**：SQLite/MySQL/Postgres 三套 migration + LATEST.sql，CI 检查 driver 一致性（`store/migration/README.md`）。

潜在瓶颈：offset 分页、没有独立全文索引（`content.contains` 是 LIKE/ILIKE）、单进程内存 cache/limiter、SSE 全量 invalidate 导致所有客户端重拉、没有列表虚拟化。对个人/小团队足够，对十万级 memo 需要升级。

### 2.9 NoteHack 应该 adopt / adapt / reject 什么

| 决策 | 内容 | 理由 |
|---|---|---|
| **Adopt** | 资源化数据模型（稳定 UID、resource name、field mask、proto/OpenAPI） | API 清晰、客户端可生成、迁移和审计容易 |
| **Adopt** | 把 placement / audience / authorship / distribution 拆开 | 避免“移动文件夹就改变权限”的隐式耦合；Space 只是协作边界，不是租户 |
| **Adopt** | fail-closed 的 memo 级授权 + 列表谓词先于分页 | 权限必须在 SQL/查询层就生效，不能拉回内存再过滤 |
| **Adopt** | 短 access + 轮换 refresh + hashed PAT + 统一 Authorizer | 认证/撤销/多传输一致性都更好 |
| **Adopt** | CEL 风格 saved views（带校验和示例） | 把“查询能力”交给用户，但保持 schema 和 SQL 安全 |
| **Adopt** | Export Format 的 manifest + 逐记录 JSON + 字节级 Markdown + 附件 + 幂等导入 | 这是最可验证、最可演进的归档设计 |
| **Adopt** | 流式导出、分块导入、validate/plan/report、路径安全/解压边界 | 大库导出导入不会打爆内存，失败可解释 |
| **Adopt** | 细粒度 rate limit + trusted proxy + AIP-193 错误契约 | 自托管实例也需要防暴力破解和资源滥用 |
| **Adapt** | Space 模型 | 可保留“零或一 placement”，但 NoteHack 可能需要多 collection/多标签；不要让 Space 变成租户 |
| **Adapt** | 评论即独立 memo | 独立生命周期很好，但会增加“评论也是一条内容”的 UI 复杂度；可按产品形态取舍 |
| **Adapt** | 标签从内容派生 | 简单、无 tag 表；但重命名标签需要重写内容，且大量标签的聚合查询会退化 |
| **Reject** | online-only + 无冲突检测 | NoteHack 如果承诺多设备/移动端，必须至少有离线草稿队列和版本检查 |
| **Reject** | offset 分页 | 深分页不稳且慢；用 keyset/cursor |
| **Reject** | 无 revision history | 至少要有 per-note 快照或操作日志，否则误删/覆盖不可恢复 |
| **Reject** | 没有独立全文索引 | LIKE 只适合小库；应上 FTS5/trigram/可选 embedding |

---

## 3. Blinko

### 3.1 核心哲学、定位与关键取舍

Blinko 的定位是 “AI-powered card note-taking project”，面向“想快速捕捉一闪而过的想法”的个人用户（`README.md`）。它把“卡片”作为第一形态：首页是 masonry 卡片墙，输入框常驻，Note 分 `BLINKO`（短灵感）、`NOTE`（长笔记）、`TODO`（待办）三种类型（`shared/lib/types.ts`、`app/src/pages/index.tsx`）。再加上 Tauri 桌面/移动端、全局 quicknote/quickai 快捷键、每日/随机回顾、AI 对话与 RAG，整体更像“个人第二大脑 + AI 工作台”，而不是纯笔记库。

技术栈与 Memos 形成鲜明对比：

- 前端 React 18 + MobX + Vite + Tailwind + HeroUI + Vditor；
- 后端 Node.js + Express + tRPC + Prisma；
- 数据库只支持 PostgreSQL（`prisma/schema.prisma`、`CLAUDE.md`）；
- 后台任务用 pg-boss；
- AI 用 Mastra/LangChain/ai SDK，多 provider，向量库是 LibSQL；
- 包管理/运行时 Bun；
- 桌面/移动用 Tauri 包装 Web 前端。

它的取舍是“**功能密度优先**”：笔记、待办、评论、分享、AI 对话、RAG、复习、RSS、OpenAI 兼容 API、MCP、插件、字体、主题、分析全都在一个应用里。代价是架构复杂、数据模型宽、默认在线、权限与一致性设计不如前两者严谨。

### 3.2 数据模型与组织方式

Blinko 的 Prisma schema 很能说明它的产品观（`prisma/schema.prisma`）：

- `accounts`：用户名、密码、头像、`apiToken`、角色、登录类型、关联账号；
- `notes`：`type`（BLINKO/NOTE/TODO）、`content` Markdown、`isArchived`、`isRecycle`、`isShare`、`isTop`、`isReviewed`、`sharePassword`、`shareEncryptedUrl`、`shareExpiryDate`、`shareMaxView`、`shareViewCount`、`metadata` JSON、`accountId`、`sortOrder`；
- `tag`：`name`、`parent`、`accountId`，形成层级标签；`tagsToNote` 多对多；
- `noteReference`：`fromNoteId`、`toNoteId`，唯一约束，表示显式引用；
- `comments`：`noteId`、`parentId`、`accountId`/guest 信息，支持嵌套回复；
- `attachments`：`noteId`、`accountId`、`path`、`type`、`size`、`isShare`、`sharePassword`、`perfixPath`、`metadata`；
- `noteHistory`：每次内容变化前的快照，`version` 递增；
- `noteInternalShare`：`noteId`+`accountId`，`canEdit` 控制内部共享编辑权；
- `conversation`/`message`：AI 对话；
- `aiProviders`/`aiModels`/`aiScheduledTask`；
- `mcpServers`、`plugin`、`fonts`、`session`、`cache`。

组织方式：

- **账户即边界**。默认查询 `accountId = ctx.id`，加上 `internalShares` 里共享给当前用户的 note（`server/routerTrpc/note.ts` 的 `list`）。没有 Space/Workspace 概念，也没有文件夹；`attachments` 有 `perfixPath` 做资源目录。
- **标签是 first-class 行**，按账户隔离，`parent` 形成树；从 `#hashtag` 解析并逐级创建父标签（`note.ts` 的 `extractHashtags` + `handleAddTags`）。
- **引用是显式 ID 关系**，UI 里通过 Reference 选择器建立；`referencedBy` 反向查询。
- **评论是独立表**，但绑定 `noteId`，与 Memos 的“评论也是 memo”不同。
- **分享是 note 字段**，不是独立 grant 表：`isShare` + `shareEncryptedUrl` + `sharePassword` + expiry + max views；内部共享是单独的 `noteInternalShare`。

这种模型适合“个人卡片库”：查询简单，卡片/评论/标签/附件的聚合很直接。缺点是：没有协作空间、没有 per-note audience 枚举（只有公开分享/内部共享/私有）、没有统一的资源命名、没有 revision 之外的冲突控制。

### 3.3 编辑器架构与内容格式

Blinko 用 **Vditor** 作为 Markdown 编辑器（`app/src/components/Common/Editor/hooks/useEditor.ts`）。Vditor 提供三种模式：

- `ir`（instant rendering，默认，接近 WYSIWYG）；
- `sv`（split view，源码 + 预览）；
- `wysiwyg`。

`EditorStore` 把用户选择存到 `localStorage`（`blinko-editor-view-mode`），并在 `useEditorInit` 中根据模式初始化 Vditor。工具栏是自定义的 React 组件（NoteType、Hashtag、Reference、Resource、AI Write、Upload、View Mode、Send），通过 portal 渲染到顶部或卡片内（`app/src/components/Common/Editor/index.tsx`）。

内容格式是 Markdown 字符串，直接存 `notes.content`。Vditor 的 IR/WYSIWYG 会在编辑时把内容规范化，Blinko 没有像 Memos 那样承诺“未编辑块字节不变”；这意味着保存后的 Markdown 可能被 Vditor 重写。它支持数学、Mermaid、Graphviz、PlantUML、ECharts、flowchart、mindmap、SMILES、ABC、音视频等，渲染依赖服务端托管的 Vditor 资源（`useEditor.ts` 的 `renderAllVditorContent`）。

草稿处理：

- 新建时 `createContentStorage`、编辑时 `editContentStorage` 存在 `localStorage`，按 note id 保存；`BlinkoEditor` 优先读取本地草稿，发送成功后清空（`app/src/components/BlinkoEditor/index.tsx`）。
- 附件上传走 `/api/file/upload`，Vditor 自带 upload hook；上传完成后把 `uploadPath` 绑定到 note（`useEditor.ts`）。
- Note 类型切换在工具栏；发送时把 `type`、`content`、`attachments`、`references`、`metadata` 一起提交。

这套编辑器的优点是“开箱即用的富文本 Markdown + 大量图表/媒体格式”，适合卡片式快速记录；缺点是“编辑器与内容格式耦合较深”，Vditor 的规范化、资源加载、主题/字体和插件扩展都会影响保存结果，且没有 SilverBullet 的 source-reveal 精细控制。

### 3.4 同步/离线模型、冲突处理与版本

Blinko 的离线能力比 README 暗示的弱，但并非完全没有：

- **Web 端是 PWA**：`vite-plugin-pwa` 生成 Service Worker，缓存应用壳和图片；`navigateFallbackDenylist` 排除 `/api/*`，API 请求默认不走缓存（`app/vite.config.ts`）。因此离线时能打开界面，但不能读取服务端数据。
- **离线新建队列**：`blinkoStore.tsx` 里有一个 `offlineNoteStorage`（localStorage），当 `navigator.onLine` 为 false 且是新建 note 时，把 note 存进队列，列表里把它和在线 notes 合并显示；恢复在线后 `syncOfflineNotes()` 逐条调用 `upsertNote`，成功后移除（`app/src/store/blinkoStore.tsx`）。这只覆盖“新建”，不覆盖编辑、删除、评论、附件同步，也没有冲突检测。
- **桌面/移动 Tauri**：本质上是把 Web 前端打包，连接到同一个服务端（`tauri.conf.json` 的 `devUrl`/`frontendDist`），不是本地数据库；离线能力仍取决于 Web 层。
- **更新是 last-write-wins**：`notes.upsert` 直接按 id `update`，没有 expected version/ETag/If-Match；并发编辑会互相覆盖（`server/routerTrpc/note.ts`）。
- **版本历史**：`noteHistory` 在内容变化前保存旧内容，`version = latest + 1`；有 `getNoteHistory`/`getNoteVersion` 查询（`note.ts`）。这是“事后快照”，不是冲突合并，也没有 diff/restore 的完整语义（UI 有 NoteHistoryModal）。
- **无多设备同步协议**：服务端是唯一真相源，客户端不做本地副本/变更日志。

因此 Blinko 的“离线”是**离线可打开 + 离线可新建**，不是“离线可编辑已有笔记”。这比 Memos 多一点，但远不及 SilverBullet。它的版本历史能缓解“覆盖后想找回”的问题，但不能防止覆盖本身。

### 3.5 安全与隐私：认证、加密、分享、API token

Blinko 的安全设计有明显的“功能先行、硬化在后”的痕迹。

**认证。**

- 本地用户名/密码 + Passport OAuth（GitHub/Google/Facebook/Twitter/Discord/自定义 OIDC），2FA TOTP challenge（`server/routerExpress/auth/index.ts`、`server/routerExpress/auth/config.ts`）。
- 登录返回 JWT，30 天过期，存 `localStorage`；API token 是另一个 JWT，100 年过期，存在 `accounts.apiToken`（`server/lib/helper.ts`）。
- Token 可以从 `Authorization: Bearer` **或 query `?token=`** 读取（`server/lib/helper.ts` 的 `getTokenFromRequest`），这会把 token 暴露在日志、Referer、浏览器历史中。
- 密码哈希是 PBKDF2-SHA512，**1000 次迭代**（`prisma/seed.ts`），按现代标准偏低；JWT 没有 refresh/rotation，也没有像 Memos 那样绑定密码 hash，改密码不会使旧 JWT 失效（除非 secret 轮换）。
- 2FA 是 per-user config（`twoFactorEnabled/twoFactorSecret` 在用户偏好键中），有 challenge + rate limit，但整体 token 生命周期太长。

**分享。**

- `shareNote` 用 `Math.random()` 生成 8 位 `[a-z0-9]` 的 `shareEncryptedUrl`，熵约 41 bit；可设 password、expireAt；`sharePassword` 明文存储，公开详情里直接 `password !== note.sharePassword` 比较（`server/routerTrpc/note.ts`）。
- 公开列表只返回 `isShare && sharePassword == "" && 未过期` 的 note（`note.ts` 的 `publicList`）。
- `shareMaxView/shareViewCount` 字段存在，但只在 `fileAccessPolicy.canReadFile` 中检查文件访问，公开详情没有递增/强制，语义未闭环（`server/lib/fileAccessPolicy.ts`、`note.ts`）。
- 附件分享用 5 分钟 JWT（`blinko-file-share` audience）+ HMAC fingerprint，绑定 note id、shareEncryptedUrl、sharePassword；公开页会把 `shareToken` 注入附件 URL（`server/lib/attachmentShare.ts`）。这比直接把文件公开好，但依赖明文 password 做 fingerprint。
- 内部共享 `noteInternalShare.canEdit` 控制编辑；非 owner 不能改 archive/top/share/recycle 状态（`note.ts` 的 upsert 权限检查）。

**文件与其它。**

- 文件访问有路径穿越防护、文件名 sanitize、MIME/`Content-Disposition`/`nosniff`/CSP sandbox/no-store；S3/本地存储（`server/lib/files.ts`、`server/lib/fileAccessPolicy.ts`、`server/routerExpress/file/file.ts`）。
- 导出下载用临时 token + TTL；导出文件在 `temp/` 下，非 superadmin 需 `canDownloadExport`（`file.ts`、`server/lib/exportDownload.ts`）。
- MCP stdio 有 `BLINKO_MCP_STDIO_ALLOWLIST`，HTTP MCP 要求认证并校验 session 用户一致（`docs/security-upgrade.md`、`server/routerExpress/mcp.ts`）。
- OpenAI 兼容端点和 RSS 设置 `Access-Control-Allow-Origin: *`，前者要求 Bearer token，后者只暴露公开分享的 notes（`server/routerExpress/openai.ts`、`rss.ts`、`server/lib/helper.ts`）。
- AI 会把 note 内容/附件文本发给配置的模型 provider；embedding 有 `excludeEmbeddingTagId` 可排除某些标签，RAG 查询在向量检索后按 `accountId` 过滤（`server/aiServer/index.ts`、`aiModelFactory.ts`）。这意味着向量索引本身是跨账户共享的，靠后置过滤保证不返回别人的 note；topK 可能被别人的向量挤占，且如果未来引入共享/空间，需要重构为 per-tenant namespace。

**隐私结论**：Blinko 没有 E2E；默认在线；AI 会把内容发给第三方 provider；分享密码/ID/KDF/token 生命周期都存在明显弱点。它适合“个人自托管、信任服务器、主要单人使用”的场景，不适合直接作为多人/敏感数据产品。

### 3.6 导入/导出与互操作性

Blinko 的互操作面很宽，但格式不统一：

- **导出**：Settings → Export，支持 Markdown/JSON/CSV，可选日期范围；生成 ZIP，附件放 `files/`，Markdown 里用相对链接；下载链接是临时 token + TTL（`app/src/components/BlinkoSettings/ExportSetting.tsx`、`server/routerTrpc/task.ts`、`server/jobs/dbjob.ts` 的 `ExporMDFiles`）。Markdown 文件名是 `note-<id>-<timestamp>.md`，没有 frontmatter/元数据，标签只存在正文里，创建时间只体现在文件名；JSON/CSV 则导出数据库字段。
- **导入**：支持单个 `.md` 或包含 `.md` 的 ZIP；每个文件直接 `notes.upsert` 成 BLINKO 类型（`server/jobs/markdownJob.ts`）。
- **从 Memos 迁移**：`server/jobs/memosJob.ts` 直接读取 Memos 的 SQLite 数据库，按 `memo`/`memo_relation`/`user`/`resource` 表导入 notes、comments、attachments；用内容匹配父 memo 和已有 note，存在重复/歧义风险，但作为迁移工具很实用。
- **RSS/Atom**：`/api/rss/:userId/rss|atom` 输出该用户的公开、无密码、未过期 notes（`server/routerExpress/rss.ts`、`server/lib/helper.ts` 的 `generateFeed`）。
- **OpenAI 兼容 API**：`POST /v1/chat/completions` 把 Blinko AI（含 RAG/tools）包装成 OpenAI Chat Completions，支持流式；这让任何 OpenAI 客户端都能把 Blinko 当“带个人知识库的模型网关”（`server/routerExpress/openai.ts`、`server/index.ts`）。
- **MCP**：内置 MCP server，暴露 search/create/update/delete/comment/web search 等工具（`server/routerExpress/mcp.ts`）。
- **插件**：插件市场 + 本地插件目录，可注入 toolbar/CSS/渲染（`server/routerTrpc/plugin.ts`、`app/src/store/plugin/`）。

优点是“**迁移和集成路径多**”：Markdown 导入、Memos 数据库导入、RSS、OpenAI 兼容、MCP 都很实用。缺点是“**没有可验证的归档标准**”：导出丢失元数据、导入不保证幂等、Memos 导入依赖表结构、Markdown 导出没有统一 frontmatter；跨版本/跨实例迁移容易出问题。

### 3.7 UX/导航模式中值得借鉴的部分

Blinko 的 UX 是三者中最“捕捉导向”的：

- **Masonry 卡片墙**：首页按屏宽 1/2/多列，卡片高度自适应，支持拖拽排序（`app/src/pages/index.tsx`、`react-masonry-css`、`@dnd-kit`）。
- **三种 note 类型**：BLINKO（灵感）、NOTE（长笔记）、TODO（待办）；TODO 视图按日期分组，显示 Today/Yesterday/日期，形成时间线（`app/src/pages/index.tsx`、`shared/lib/types.ts`）。
- **Review 模式**：每日 review 是“最近 24 小时未 review 的 notes”，随机 review 是 `ORDER BY RANDOM()`；用 Swiper 卡片滑动，支持标记 reviewed、在 BLINKO/NOTE 间转换、归档、编辑（`app/src/pages/review.tsx`、`server/routerTrpc/note.ts`）。这不是严格的间隔重复，但“每日回看 + 随机重温”的仪式感很强。
- **Quick Note / Quick AI**：Tauri 全局快捷键打开独立小窗口，`alwaysOnTop`、`skipTaskbar`、透明、自动调整高度；quicknote 直接写，quickai 直接问（`app/src-tauri/tauri.conf.json`、`app/src/pages/quicknote.tsx`、`quickai.tsx`、`useQuicknoteHotkey.ts`）。
- **资源库**：附件按文件夹/类型管理，支持图片、音频、文档、未使用资源；图片有缩略图/压缩（`app/src/pages/resources.tsx`、`server/lib/files.ts`）。
- **标签树、引用、AI 对话**：侧边栏标签树；note 详情显示 references/referencedBy；AI chat 可带 RAG 并返回引用 notes（`app/src/components/BlinkoAi`、`server/routerTrpc/ai.ts`）。
- **插件/主题/字体/多语言**：可扩展工具栏、CSS、字体；移动端有独立导航（`app/src/store/baseStore.ts`、`plugin`）。
- **多端**：同一套 Web UI 通过 Tauri 打包到 macOS/Windows/Linux/Android，降低成本（`README.md`、`CLAUDE.md`）。

这些 UX 的精华是“**capture → review → refine**”的闭环：先用最低摩擦记下来，再通过 review 卡片回看、转换类型、补标签/引用。NoteHack 如果做“日常记录 + 长期知识”，这个闭环比纯文件树更符合真实习惯。

### 3.8 规模与性能技术

Blinko 的性能设计是“**靠缓存、后台任务和代码分割顶住功能密度**”，数据库层相对薄弱：

- **Postgres + Prisma**：所有查询走 ORM；notes 列表用 `skip/take`（offset 分页），`orderBy [isTop, sortOrder, time]`，一次 `include` 标签、附件、评论、references、referencedBy、counts（`server/routerTrpc/note.ts` 的 `list`）。这是典型的 N+1/大 join 风险。
- **索引很少**：`prisma/schema.prisma` 只给 conversation/message/noteHistory/noteInternalShare/session/aiModels/aiScheduledTask 建了索引；`notes` 没有 `(accountId, isArchived, isRecycle, createdAt)` 之类的复合索引，列表和 review 查询会随数据量变慢。
- **标签创建是逐条 find/create**：`handleAddTags` 递归遍历标签树，每个标签一次查询/创建；大笔记 + 深层标签会产生很多 round trip（`note.ts`）。
- **搜索是 `contains`（ILIKE）**：`note.list` 用 `content: { contains: searchText, mode: 'insensitive' }`，没有全文索引；数据量大时全表扫描（`note.ts`）。
- **缓存**：通用 `LRUCache`（30MB/10000 项）用于配置、插件列表、公开列表、版本等；`getGlobalConfig` 仍然每次 `prisma.config.findMany()`，配置多时是隐性成本（`shared/lib/cache.ts`、`server/routerTrpc/config.ts`）。
- **后台任务**：pg-boss 跑 archive、DB backup、embedding rebuild、recommend、AI scheduled task；embedding 重建分批、可强制重启（`server/jobs/rebuildEmbeddingJob.ts`、`server/index.ts`）。
- **RAG**：`MDocument.fromMarkdown(content).chunk()`，`embedMany`，写入 LibSQL vector store（index `blinko`，cosine），metadata 带 noteId/createTime/updatedAt；查询 `topK`（默认 3）+ score 阈值（默认 0.4），再按 `accountId` 过滤 notes（`server/aiServer/index.ts`、`aiModelFactory.ts`）。向量索引是全局的，post-filter 保证返回结果，但 topK 可能被其他账户内容占用。
- **前端**：Vite manualChunks 拆 react/ui/utils；Vditor 资源本地托管 + gzip；PWA 缓存壳/图片；编辑器懒加载；卡片墙无虚拟化，长列表靠分页/加载全部（`app/vite.config.ts`、`index.tsx`）。
- **上传**：busboy 流式写，支持 S3/本地，图片 sharp 处理/缩略图；上传大小基本不限制（Vditor 侧 1GB），需要部署层兜底（`server/routerExpress/file/upload.ts`、`server/lib/files.ts`）。

结论：Blinko 的性能对“个人几千条卡片”足够，但对“十万条 + 多用户 + 搜索/RAG”会先遇到数据库索引和 offset 分页瓶颈；RAG 的全局向量索引也需要 per-user namespace 才能既公平又安全。

### 3.9 NoteHack 应该 adopt / adapt / reject 什么

| 决策 | 内容 | 理由 |
|---|---|---|
| **Adopt** | 常驻 composer + 卡片墙 + 三种 note 类型 | 降低捕捉摩擦，同时给“灵感/长文/待办”不同呈现 |
| **Adopt** | Quick Note / Quick AI 全局快捷键（桌面端） | 捕捉窗口越短，记录率越高；这是 Blinko 最强的产品差异 |
| **Adopt** | Review 闭环（每日/随机回看 + 类型转换） | 把“记录”变成“复用”，比纯搜索更主动 |
| **Adopt** | per-note history 快照 | 至少能找回被覆盖的内容；实现成本远低于完整 CRDT |
| **Adopt** | 内部共享 + canEdit、RSS/OpenAI 兼容/MCP | 低成本集成路径，能快速接入生态 |
| **Adopt** | Memos SQLite 导入这种“迁移工具”思路 | 降低用户切换成本，但应改成基于标准导出格式，而不是绑定表结构 |
| **Adapt** | RAG/AI | AI 应可选、可关闭、per-user 向量命名空间、明确告知内容会发给哪个 provider；默认本地/自托管 embedding 更好 |
| **Adapt** | Review 算法 | 从“24h 未读 + 随机”升级为真正的间隔重复（SM-2/FSRS），并记录难度/间隔 |
| **Adapt** | 卡片墙 | 小库很好；大库需要虚拟化、分组、搜索优先，否则滚动成本高 |
| **Reject** | 无离线编辑 / last-write-wins | 多设备场景不可接受；至少要有离线草稿队列 + 版本检查 + 冲突提示 |
| **Reject** | 8 位 `Math.random()` 分享 ID + 明文分享密码 | 熵不足、明文存储、比较不是常量时间；必须用 CSPRNG + Argon2/bcrypt hash |
| **Reject** | 30 天 JWT 存 localStorage、100 年 API token、query token | 令牌生命周期过长、泄露面大；应短 access + 轮换 refresh + hashed PAT，禁止 URL token |
| **Reject** | PBKDF2 1000 次 | 现代最低标准远高于此；用 Argon2id/scrypt/bcrypt cost ≥ 12 |
| **Reject** | notes 缺复合索引 + offset 分页 + ILIKE 搜索 | 数据量一大就退化；用 keyset + 复合索引 + FTS |
| **Reject** | 全局 vector index + post-filter | topK 公平性和隔离都差；用 per-user/per-space namespace |

---

## 4. 横向综合：共性、差异与底层原因

### 4.1 一张表看清三者

| 维度 | SilverBullet | Memos | Blinko |
|---|---|---|---|
| 内容单元 | Page（`.md` 文件）+ Document | Memo（独立资源） | Note/Card（BLINKO/NOTE/TODO） |
| 真相源 | 磁盘文件 | 服务端数据库 | 服务端数据库 |
| 组织 | 文件/文件夹 + wiki link + tag + object graph | 时间线 + tag + saved view + Space | 卡片墙 + 层级 tag + reference + review |
| 编辑器 | CodeMirror 6，Live Preview，source reveal | 块编辑器，Markdown 存储，source mode | Vditor IR/SV/WYSIWYG |
| 离线 | 完整本地副本 + 双向同步 + 三方合并 | 无 | 仅离线新建队列 + PWA 壳缓存 |
| 冲突 | ETag + base + 3-way merge + 冲突 UI | last-write-wins | last-write-wins + 历史快照 |
| 版本 | Git revisions（Managed/Unmanaged） | 无 | noteHistory 快照 |
| 权限 | Space 级 none/read/write + admin；write=脚本执行 | memo 级 audience + Space membership + admin | 账户级 + 公开分享 + 内部共享 canEdit |
| 分享 | 整 Space 公开只读；Share push/pull/sync 到外部 | capability token，单 memo，可过期；禁止 SPACE | 8 位链接 + 明文密码 + 过期；内部共享 |
| 导入导出 | 文件夹/Git；页面导出；Share 协议 | 标准化 ZIP + manifest + 幂等导入 | MD/JSON/CSV zip；MD/ZIP 导入；Memos DB 导入 |
| 扩展 | Space Lua + Plugs + Libraries | API/MCP/Webhook；无插件运行时 | 插件市场 + MCP + OpenAI 兼容 |
| 规模策略 | 客户端索引 + 服务端 FTS/语义搜索 | CEL→SQL + 索引 + 内存 cache | 缓存 + 后台任务 + 向量检索，DB 索引弱 |
| 适合谁 | 重度个人/小团队、文件控、脚本控 | 个人/小团队、时间线记录、重视 API/权限 | 个人、卡片/灵感、AI 重度用户 |

### 4.2 共同点

**1. 都用 Markdown 作为“可退出”的底层格式。** SilverBullet 是 `.md` 文件；Memos 的 memo content 是 Markdown 字节；Blinko 的 note content 也是 Markdown。三者都把“渲染”与“存储”分离，原因很现实：Markdown 足够表达日常内容，工具链成熟，用户可读，迁移成本低。即使数据库是权威（Memos/Blinko），内容仍然可以导出成文本。

**2. 都在“源内容”之上建立派生索引。** SilverBullet 有 Object Index + relation graph + server FTS/semantic；Memos 有 payload tags/property + CEL filter；Blinko 有 tag 表、noteReference、noteHistory、vector index。共同模式是：**写入时抽取结构化事实，读取时用索引/查询而不是全文扫描**。差别在于索引放在哪：SilverBullet 主要放客户端，Memos 放 SQL，Blinko 放 SQL + 向量库。

**3. 都用“标签/引用/时间”而不是纯文件夹来组织。** 三者都有 tag；SilverBullet 有 wiki link/backlink，Memos 有 reference/comment relation，Blinko 有 noteReference。原因：笔记的关联是网状的，文件夹是树状的；树适合权限/边界，不适合知识发现。三者的差异是“谁承担图的查询”：SilverBullet 的 object index，Memos 的 SQL relation，Blinko 的 Prisma relation。

**4. 分享都走向“capability link”。** SilverBullet 的 Share 是 URI + OAuth/device code；Memos 是 shortuuid token；Blinko 是 8 位 URL + 可选密码。共同原因是自托管产品很难要求访客注册；链接是最低摩擦的授权方式。差别在安全成熟度：Memos 的 token 熵/过期/单资源约束最好，SilverBullet 把分享变成可同步的内容属性，Blinko 最弱。

**5. 都在向“AI 可选层”演进。** SilverBullet 在服务端本地跑 embedding，Memos 只做语音转写，Blinko 把 AI 做成核心卖点。共同点是 AI 都不改变底层内容格式；差异是隐私/成本模型：本地 embedding（SilverBullet）最保守，服务端配置 provider（Memos）居中，启用 AI 后把内容发给第三方 provider（Blinko）最激进。

### 4.3 关键差异的底层原因

**内容粒度决定架构。**

- Page/文件粒度 → 需要链接、backlink、object index、文件监听、三方合并（SilverBullet）。
- Memo 粒度 → 需要时间线、标签、可见性、Space、API 资源（Memos）。
- Card 粒度 → 需要快速输入、卡片墙、review、AI/RAG、类型切换（Blinko）。

这不是审美差异，而是**数据单元的大小决定了索引、同步和 UI 的成本**。页面越大，合并越难但冲突越少；卡片越小，写入越快但数量越多、检索越重要。

**协作承诺决定同步模型。**

- SilverBullet 承诺“离线也能编辑同一批文件”，所以必须做本地副本、ETag、base、三方合并、删除/编辑规则。
- Memos 不承诺离线，所以可以用服务端权威 + last-write-wins + SSE invalidate。
- Blinko 承诺“随时捕捉”，但只做到“离线新建”，所以只需要一个 localStorage 队列，不需要真正的同步引擎。

结论：**如果你不想实现同步，就不要在产品上承诺离线编辑**；如果承诺了，冲突处理不是可选项。

**存储边界决定权限模型。**

- SilverBullet 的边界是 Space/文件夹，所以权限是 Space 级；脚本执行让 write 变成高信任操作。
- Memos 的边界是 memo 行，所以可以做到 memo 级 audience + Space membership；代价是每条查询都要带 audience 谓词。
- Blinko 的边界是 account，所以只有“我的/公开分享/内部共享”，没有真正的多租户协作。

结论：**权限粒度越细，查询和缓存越复杂**；如果产品早期不需要多人，账户级 + capability share 足够；一旦要做团队，必须把 audience 作为 SQL 谓词而不是 UI 过滤。

**可编程性决定安全模型。**

SilverBullet 的 Space Lua 是“内容即代码”，因此它必须用 hostname 隔离、shell 关闭、runtime 权限来兜底；Memos/Blinko 没有内容级脚本，攻击面小得多，但扩展性也弱。NoteHack 如果要做插件/自动化，应该走“**声明式权限 + 沙箱 API**”，而不是“笔记里写代码，打开就执行”。

**检索需求决定索引位置。**

- 个人小库：客户端索引（SilverBullet）最快、最离线，但冷启动/存储成本高。
- 中等规模：SQL + CEL（Memos）最简单，但全文/语义弱。
- AI 场景：向量索引（Blinko）必要，但必须解决 per-user 隔离和 topK 公平性。

没有一种索引能同时满足“离线、全文、语义、低延迟、低成本”；合理做法是**分层**：本地 FTS/对象索引 + 服务端可选语义索引。

### 4.4 三者共同的“反面教材”

1. **分享密码/令牌的工程化不足**：Blinko 的 8 位随机 ID + 明文密码是典型反例；SilverBullet 的分享依赖外部 provider 的 OAuth，Memos 的 share token 最规范，但也没有密码保护（靠不可猜 token）。NoteHack 应统一用 CSPRNG token + 可选 Argon2 密码 + 过期 + 撤销 + 审计。
2. **把“在线”当成默认假设**：Memos/Blinko 都缺少真正的离线编辑；移动端/弱网体验会迫使用户回到中心化云笔记。
3. **版本历史与冲突处理被低估**：Memos 没有 revision；Blinko 有快照但不做冲突检测；SilverBullet 做得最好，但依赖 Git。NoteHack 至少要有“每次保存的快照 + 冲突提示”。
4. **数据库索引/分页的债**：Blinko 的 notes 缺复合索引、用 offset；Memos 也用 offset；数据量一大就会暴露。
5. **AI 的隐私边界不透明**：Blinko 一旦启用 AI 就把内容发给 provider；Memos 只做转写；SilverBullet 本地 embedding 最保守。NoteHack 应把“AI 处理发生在哪里、发给谁”做成显式设置。

### 4.5 对 NoteHack 的最终建议

如果 NoteHack 的目标是“**个人和小团队的、可离线、可长期演进的知识库**”，建议采用以下组合：

**架构基线**

1. **本地优先 + 可选服务端**：本地用 SQLite/OPFS 保存 notes、索引、草稿、变更日志；服务端只做同步、备份、分享、搜索增强。这样既能在单机离线工作，也能多设备。
2. **Markdown 作为内容格式，稳定 ID 作为身份**：每条 note 有不可变 UID；Markdown 文件/数据库行都带 UID；导出时同时给 `notes/<uid>.md` 和 `notes/<uid>.json`（元数据），避免 SilverBullet 的“路径即身份”重命名问题。
3. **同步协议**：每条 note 保存 `base_hash`、`remote_hash`、`local_rev`；写入用 `If-Match`；冲突走三方合并；二进制冲突生成副本；删除 vs 编辑遵循“编辑获胜 + 通知”；tombstone 保留足够长时间；离线队列按 note 合并，而不是按操作重放。
4. **编辑器**：CodeMirror 6 + Live Preview（source reveal），支持块命令、slash menu、任务、表格、代码、Mermaid；未编辑块尽量字节保持；提供 raw Markdown 模式。不要一开始就做 Vditor 式 WYSIWYG，Markdown 的可迁移性更重要。
5. **数据模型**：Note(uid, content, type, tags, relations, collection/space, audience, timestamps, attachments) + 派生索引（FTS、tag、link、embedding）。把 `collection/space`（放在哪）与 `audience`（谁能看）分开；Space 是协作边界，不是租户；评论可以作为独立 note + relation，也可以作为子资源，但授权必须逐条判定。
6. **API**：资源化 HTTP/JSON 或 Connect/protobuf；稳定 resource name；field mask；cursor/keyset 分页；CEL 风格 filter 编译到 SQL；saved views；批量接口按 item 计费；OpenAPI 生成客户端。
7. **安全**：Argon2id 密码；短 access（15 分钟）+ 轮换 refresh（HttpOnly）+ hashed PAT；分享用 128-bit CSPRNG token + 可选密码 hash + 过期/撤销/最大查看次数；禁止 token 出现在 URL；per-user/per-IP rate limit；文件 `private, no-store` + MIME 重新嗅探 + EXIF 剥离 + 路径穿越防护；AI 走用户显式配置的 provider，默认不发送。
8. **导入导出**：以 Memos Export Format 为蓝本，但 schema 更通用：ZIP + `manifest.json` + 每 note JSON + 字节级 Markdown + attachments；导入幂等、可 validate/plan/report；同时支持“Markdown 文件夹导入/导出”作为最低门槛；提供从 Memos/Blinko/SilverBullet 的迁移脚本。
9. **UX**：三种入口并存：
   - **Today/Timeline**（Memos 式）用于快速记录；
   - **Card/Review**（Blinko 式）用于回看、转换、补全；
   - **Page/Graph**（SilverBullet 式）用于长文、链接、查询。
   统一命令面板（Cmd-K）、全局快速捕捉（桌面快捷键）、标签树、Saved Views、日历/地图、附件库、Inbox。
10. **性能**：notes 上建 `(owner_id, status, created_at DESC, id DESC)`、`(space_id, status, created_at DESC)` 等复合索引；keyset 分页；FTS5/trigram 全文；可选本地 embedding（per-user namespace）；缓存只做读多写少；后台任务用队列而不是请求内同步。

**明确不要做**

- 不要用“文件夹即权限”或“Space 即租户”的模型；也不要把“write 权限”直接等同于“可执行脚本”。
- 不要在没有冲突检测的情况下承诺多设备编辑；不要用 offset 分页撑大库。
- 不要用明文分享密码、短随机 ID、100 年 token、query token、弱 KDF。
- 不要把 AI 做成默认全量上传；不要让全局向量索引靠后置过滤保证隔离。
- 不要发明只服务自己的归档格式；导出必须可被第三方工具读取和验证。

**一句话**：NoteHack 的最佳路线不是“选一个抄”，而是 **SilverBullet 的同步/索引内核 + Memos 的资源/权限/导出纪律 + Blinko 的捕捉/复习 UX**。这三者分别代表了“可信的文件系统”“可信的 API”“可信的注意力产品”，把它们拼在一起，才是下一代自托管笔记系统真正缺的那块。
