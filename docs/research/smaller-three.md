# 三个“小而完整”的 Markdown 笔记系统深读：flatnotes、NoteDiscovery、Livebook

> 阅读范围：`/root/research/flatnotes`、`/root/research/NoteDiscovery`、`/root/research/livebook` 的 README、docs、后端、前端、editor、sync、auth、sharing、import/export 与关键配置。以下路径均为仓库内相对路径，行号用于定位证据，不表示唯一实现位置。
>
> 这三个项目分别代表三种极端的取舍：**flatnotes 把“文件即应用”做到了近乎偏执**；**NoteDiscovery 在纯文件之上堆出一套单用户知识库的完整体验**；**Livebook 把“文档”和“运行中的会话”彻底分离，做出了真正的多人实时协作与可部署应用**。NoteHack 不需要复制其中任何一个，但可以从三者身上各取一层。

---

## 一、flatnotes：把“Notes are just markdown files”贯彻到底

### 1.1 核心哲学、定位与关键取舍

flatnotes 的定位非常清楚：自托管、无数据库、用一个扁平文件夹里的 Markdown 文件做存储的笔记 Web 应用（`README.md:8`）。它的设计原则是“content first”和“不把笔记当人质”：

- 没有 folder、notebook 等层级，所有笔记平铺，用全文搜索和标签来组织（`README.md:24-34`）。
- 唯一缓存的是搜索索引，而且每次搜索和启动时增量同步；因此用户可以在 flatnotes 运行期间从外部增删改 Markdown 文件（`README.md:32-34`）。
- UI 刻意保持简单，功能扩张被主动限制（`README.md:104-106`）。

关键取舍是：**为了极致的可迁移性和低心智负担，放弃了层级、版本、协作、分享、离线编辑和真正的多用户**。它把“文件名/标题/URL/搜索索引主键”压成同一个东西，这带来了极简，也带来了后面会讨论的结构性限制。

### 1.2 数据模型与组织

数据模型薄到不能再薄：

- 一篇笔记就是一个 `<title>.md` 文件，存放在 `FLATNOTES_PATH` 下；标题就是文件名，也是 URL 路径参数（`server/notes/file_system/file_system.py:27, 50-57, 166-167`）。
- `Note` 只有 `title`、`content`、`last_modified` 三个字段（`server/notes/models.py:23-26`）。没有 frontmatter、没有 UUID、没有创建时间、没有作者、没有权限字段。
- 标签不是独立元数据，而是正文里的 `#tag`，由正则从内容中抽取；提取时会先剔除代码块，然后转小写、去重，写入 Whoosh 的 `tags` 字段（`server/notes/file_system/file_system.py:44-48, 194-207`）。标签本身仍然留在正文里展示。
- 附件统一放在 `<vault>/attachments/`，文件名冲突时追加 UTC 时间戳后缀（`server/attachments/file_system/file_system.py:22-35, 50-54`）。附件没有按笔记分目录，也没有内容寻址。
- 搜索索引默认放在 `<vault>/.flatnotes/`，也可以挂载到独立卷；索引 schema 有版本号，版本不匹配会重建（`server/notes/file_system/file_system.py:28-40, 162-192`）。

这种模型最大的优点是“任何工具都能读写”，缺点是**重命名会改变身份**：wikilink 是按标题解析的（`client/components/toastui/extendedAutolinks.js:78-91`），把 `A.md` 改成 `B.md` 不会自动改其他笔记里的 `[[A]]`，旧链接和外部书签会直接断掉。对于 NoteHack，这是必须避开的坑。

### 1.3 编辑器架构与内容格式

flatnotes 前端是 Vue 3 + Pinia + PrimeVue，编辑器使用 TOAST UI Editor：

- 同一套内容支持 **Markdown 源码模式**和 **WYSIWYG 模式**，保存时统一调用 `getMarkdown()` 取回 Markdown（`client/components/toastui/ToastEditor.vue:25-53`）。
- 查看模式用 TOAST UI Viewer，并在 `baseOptions.js` 中给标题生成 anchor id，把 `#hash` 链接转成当前路由的绝对链接（`client/components/toastui/baseOptions.js:4-34`）。
- 通过自定义 autolink 把 `[[Note]]` 解析为 `/note/:title` 路由，把 `#tag` 解析为搜索路由（`client/components/toastui/extendedAutolinks.js:78-127`）。这让“纯 Markdown”看起来像 wiki，但解析只发生在渲染层。
- 图片上传走 `addImageBlobHook`，上传后把返回的相对 URL 插入 Markdown（`client/views/Note.vue:360-416`）。

编辑体验是**显式保存**，不是自动保存：用户点 Save 或 `Ctrl/Cmd+Enter`；编辑过程中有 1 秒 debounce 的“未保存变更”检测，并把草稿写入浏览器存储（`client/views/Note.vue:252-314, 418-464`）。如果用户选择“记住登录”，草稿放 `localStorage`，否则放 `sessionStorage`；草稿的 key 是笔记标题（`client/views/Note.vue:443-463`）。再次进入编辑时会提示“恢复草稿/删除草稿”（`client/views/Note.vue:25-39, 216-229`）。

这里有两个值得借鉴也有风险的点：

- 值得借鉴：**本地草稿 + beforeunload + 离开确认**，在“显式保存”模型下是必要的安全网。
- 风险：草稿以标题为 key，重命名后旧草稿会变成孤儿；草稿只存在单浏览器，不跨设备；没有服务端草稿。

### 1.4 同步/离线模型、冲突处理、版本

flatnotes 基本没有“同步”这个概念：

- 浏览器必须能访问服务器；没有 Service Worker、没有本地数据库、没有离线队列。
- 保存是 `PATCH /api/notes/{title}`，服务端直接用新内容覆盖整个文件（`server/main.py:109-128`；`server/notes/file_system/file_system.py:80-102`）。没有 `If-Match`、没有版本号、没有 base hash、没有 merge。
- 因此并发写入是**最后写入者获胜（last-write-wins）**，而且两个标签页同时编辑时，后保存的人不会收到任何冲突提示。打开中的笔记也不会自动感知磁盘变化；只有重新加载才会看到外部修改。
- 搜索索引会在每次搜索前与文件夹同步，能发现外部新增/删除/修改的文件（`server/notes/file_system/file_system.py:234-286`）。这个“索引可重建、文件是真相”的思想很好，但它只解决搜索，不解决编辑冲突。
- 没有版本历史、没有回收站、没有软删除；删除就是 `os.remove`（`server/notes/file_system/file_system.py:104-108`）。

对 NoteHack 的启示是：**“文件是 source of truth”并不等于“可以不要并发控制”**。只要有两个标签页、一个同步工具或一个 AI agent，覆盖写就会丢数据。

### 1.5 安全与隐私：认证、加密、分享

flatnotes 提供四种认证模式：`none`、`read_only`、`password`、`totp`（`server/global_config.py:105-109`）。具体实现：

- 单用户，用户名/密码从环境变量读取；JWT 使用 HS256，默认 30 天过期（`server/auth/local/local.py:22-31, 92-111`）。
- TOTP 模式下，服务端把“密码 + 当前 TOTP”拼成一个字符串做常量时间比较，并记录 `last_used_totp` 防止同一 TOTP 重放（`server/auth/local/local.py:43-74`）。客户端也把 `password + totp` 作为 password 提交（`client/api.js:56-62`）。这不是标准 TOTP 流程，但功能上可行。
- Token 同时放在 Authorization header 和 `token` cookie 中；cookie 设置 `SameSite=Strict`，但**不是 HttpOnly**，因为前端要读；同时写 `sessionStorage`，勾选“记住我”再写 `localStorage`（`client/tokenStorage.js:8-37`）。这意味着 XSS 可以直接偷走长期 token。
- `read_only` 模式不是靠运行时权限判断，而是在注册路由时直接不注册写接口（`server/main.py:87, 227`），实现简单、攻击面小。
- 没有用户/角色/ACL，没有笔记级权限，没有加密 at rest，没有内置 TLS，没有 CSRF token，也没有速率限制。`SameSite=Strict` 缓解了一部分 CSRF，但不能替代完整防护。
- 没有分享功能；附件接口和笔记接口一样受认证保护；标题校验禁止 `<>:"/\|?*`，避免路径穿越（`server/helpers.py:16-25`）。

定位上它是“个人或家庭内网工具”，不是“可暴露到公网的多租户服务”。README 也明确建议用 Docker、设置强随机 secret（`README.md:63-100`）。

### 1.6 导入/导出/互操作性

flatnotes 没有导入/导出 UI，也没有 zip/HTML/PDF 导出。它的互操作性完全来自文件系统：

- 笔记是普通 `.md`，附件是普通文件，外部编辑器可以直接改。
- 标签是正文内 `#tag`，wikilink 是 `[[Title]]`，都不是标准 Markdown 扩展，但语义简单。
- 没有 frontmatter，因此无法携带别名、日期、来源、封面等结构化元数据；也没有办法把“附件 + 笔记”打包成一个可移植 bundle。
- FastAPI 自动暴露 `/docs` 和 `/openapi.json`（`server/main.py:23-27`），API 可编程，但 API 面很窄。

它的“可迁移”是**文件级**的，不是**应用级**的：把文件搬到 Obsidian 能读，但标签、wikilink、附件相对路径的语义需要重新解释。

### 1.7 UX/导航模式

flatnotes 的 UX 是“搜索即导航”：

- 首页是居中的 Logo + 大搜索框 + “最近修改”快捷入口；快捷入口的标题、搜索词、排序、数量都可通过环境变量配置（`client/views/Home.vue:1-86`；`server/global_config.py:54-91`）。
- 任意页面按 `/` 打开搜索 modal；`Ctrl/Cmd+Alt+N` 新建，`Ctrl/Cmd+Alt+H` 回首页（`client/App.vue:42-64`）。
- 搜索框输入 `#` 会弹出标签自动补全，支持方向键选择（`client/partials/SearchInput.vue:120-154`）。
- 搜索结果按 score/title/last modified 排序，展示标题高亮、正文高亮和命中标签（`client/views/SearchResults.vue:19-40, 100-108`；`server/notes/file_system/file_system.py:324-365`）。
- 笔记页只有“查看/编辑”切换，`e` 进入编辑，`Esc` 退出，`Ctrl/Cmd+Enter` 保存（`client/views/Note.vue:466-483`）。没有侧边栏树、没有大纲、没有 backlinks、没有 graph。

值得 NoteHack 借鉴的是**首页就是搜索框**、**标签输入即筛选**、**极少的键盘命令**。这套模式对“我知道我要找什么”的场景效率极高；不适合“我需要浏览和发现”的场景。

### 1.8 规模与性能技术

flatnotes 的性能核心是 Whoosh 索引：

- schema 对 title 和 tags 做 2 倍 boost，content 做正文索引，使用 stemming + accent folding，并启用日期解析插件（`server/notes/file_system/file_system.py:30-40, 125-129`）。
- 启动时同步一次索引；每次搜索前再同步：删除不存在的文件、按 mtime 更新变化文件、加入新文件，必要时 optimize（`server/notes/file_system/file_system.py:234-270`）。
- 索引写入有锁冲突重试（最多 8 次、每次 0.25s）（`server/notes/file_system/file_system.py:272-286`）。
- 搜索命中后为了生成高亮，会重新读取笔记正文（`server/notes/file_system/file_system.py:341-348`）。结果没有分页，`limit` 只是可选参数（`server/main.py:152-166`）。

优点是索引完全可丢弃、可从文件重建；缺点是每次搜索都要 stat 整个目录，笔记量大时是 O(N)，且单进程 Whoosh 不适合高并发。对几千篇笔记很够用，对十万级就不合适。

### 1.9 NoteHack 应该 adopt / adapt / reject

**Adopt（直接吸收）**

- **文件即真相 + 索引可重建**：把搜索、标签、链接图都当作 derived data，任何索引损坏都能从 Markdown 重建。这是 flatnotes 最有价值的架构约束。
- **搜索优先的首页**：大搜索框 + 最近修改 + `/` 全局唤起，适合作为 NoteHack 的默认入口之一。
- **标签自动补全、搜索结果高亮、按相关性/时间/标题排序**。
- **本地草稿 + beforeunload + 离开确认**，即使 NoteHack 做自动保存，也应保留崩溃恢复。
- **read_only 通过不注册写路由实现**，简单且安全。

**Adapt（改造后采用）**

- 把“标题 = 文件名 = 主键”改成 **稳定 ID + 可改标题 + 文件名 slug**。URL 用 ID 或“ID + slug”，wikilink 解析用 ID/别名，重命名时自动更新引用。
- 把“每次搜索 stat 全目录”改成 **增量索引 + 后台任务 + 文件监听/定时扫描**，并支持分页。
- 把“显式保存”改成 **自动保存 + 显式版本点**；草稿存 IndexedDB，而不是以标题为 key 的 localStorage。
- 把“内联 #tag”扩展为 **frontmatter tags + 内联 tags 双读**，兼容 Obsidian 等工具。
- 认证从单用户 env 升级为 **多用户 + 会话 + CSRF + 速率限制**；token 不放 localStorage，或至少使用短期 access token + HttpOnly refresh cookie。

**Reject（明确不要）**

- 用文件名/标题作为唯一身份和 URL。它会同时破坏重命名、链接、分享、版本和多设备同步。
- 无并发控制的整文件覆盖写。
- 没有版本/回收站/软删除。
- 单全局密码、默认关闭认证、无加密、无审计。
- 没有导入/导出 bundle；只靠“文件在磁盘上”不能算完整的可迁移性。
- 没有分页的搜索和 O(N) 全目录扫描作为长期方案。

---

## 二、NoteDiscovery：在纯文件之上做“完整的单用户知识库”

### 2.1 核心哲学、定位与关键取舍

NoteDiscovery 的定位是“self-hosted knowledge base”：面向隐私敏感用户、开发者、知识工作者和 small team，强调 Markdown + 本地文件、无订阅、无锁定、速度快、可离线（README 的宣传语）、可扩展（插件/MCP）、可定制主题（`README.md:17-81`）。相比 flatnotes，它明显选择“功能完整度优先”：

- 有文件夹树、标签、wikilink、backlinks、graph、outline、favorites、模板、绘图、HTML 导出/打印、公开分享、插件、MCP、PWA、主题、i18n。
- 仍然坚持 Markdown 文件在文件夹里，不引入数据库；搜索/链接/标签索引放在进程内存中。
- 目标部署是单用户或小团队，README 明确建议不要直接暴露公网，认证默认关闭、默认密码 `admin`（`README.md:314-344`）。

关键取舍是：**用单进程 Python + 进程内索引 + 文件系统，换取部署简单和“文件仍然可读”；代价是没有真正的多用户、离线编辑、版本历史和水平扩展**。

### 2.2 数据模型与组织

NoteDiscovery 的 vault 是一棵普通目录树：

- 笔记是 `.md` 文件；路径（vault-relative POSIX）就是身份。`NoteRecord` 包含 `path`、`name`、`folder`、`modified`、`size`、`type`、`mtime`、`tags`（`backend/note_index.py:67-78`）。
- 标签来自 YAML frontmatter 的 `tags:`，支持 inline array、单值和多行列表，统一小写去重（`backend/utils.py:1051-1131`）。正文里的 `#tag` 不是标签来源，这点和 flatnotes 相反。
- 链接同时支持 `[[wikilink]]`（可带 `|display`、`#heading`）和标准 Markdown `[text](note.md)`；`WIKILINK_RE` 和 `MDLINK_RE` 负责抽取（`backend/note_index.py:39-47`）。
- 附件放在笔记同级的 `_attachments/`（根目录笔记则放根 `_attachments/`），文件名带时间戳；文档、音视频、PDF 都支持（`backend/utils.py:934-952`；`documentation/API.md:298-326`）。
- 模板放在 `_templates/`；绘图是 `drawing-*.png`，直接放在笔记旁边（`documentation/FEATURES.md:51-59`）。
- 分享 token 存在 vault 根目录的 `.share-tokens.json`，这是应用状态而不是笔记内容（`backend/share.py:144-176`；`documentation/SHARING.md:89-103`）。
- 索引只存在进程内存，启动后第一次 `/api/notes` 触发扫描；之后保存/删除/移动/重命名走增量更新（`backend/note_index.py:1-10, 218-254`）。

这个模型比 flatnotes 更实用，但仍然把**路径当主键**。它做了大量防御：大小写不敏感冲突检查、禁止 `#`、忽略 dotfiles、系统文件夹用 `_` 前缀（`backend/utils.py:626-711`；`backend/main.py:2025-2035`）。重命名笔记时，会通过 `/api/notes/move` 保留 share token 并重写路径（`frontend/app.js:6304-6354`），但**其他笔记里指向旧路径的 Markdown link 不会自动改写**；wikilink 按 stem 解析，所以只改文件名时可能仍能命中，改文件夹时更容易断。

### 2.3 编辑器架构与内容格式

NoteDiscovery 的编辑器是“**原生 textarea + 浏览器端 Markdown 渲染**”，不是 WYSIWYG：

- 前端是 Alpine.js 单页应用，`<textarea id="note-editor" x-model="noteContent">` 是唯一编辑面（`frontend/index.html:2865-2884`）。
- 预览用 `marked.parse()` 渲染，再用 DOMPurify 清洗；支持 GFM、表格、任务列表、代码高亮、MathJax、Mermaid、callouts、图片尺寸语法（`frontend/app.js:6874-6916`；`frontend/index.html:88-102`）。
- 三种视图：Edit / Split / Preview；滚动同步不是简单百分比，而是从源码行号建立 anchor，处理标题、图片、表格、代码块、Mermaid 的布局差异（`frontend/app.js:7252-7800`）。
- 自动保存：输入后 1 秒 debounce 调 `saveNote()`；服务端 debounce 可通过 `AUTOSAVE_DELAY_MS` 配置，clamp 到 250–60000ms（`frontend/app.js:5802-5831`；`backend/main.py:318-326`）。
- 撤销/重做是自定义的 snapshot 栈，保存 content + 光标位置，默认最多 50 步（`frontend/app.js:5835-5949`；`frontend/app.js:29`）。它不是浏览器原生 undo，所以能跨自动保存保留历史。
- Wikilink 自动补全在客户端用已加载的 notes 列表计算，支持 `[[` 笔记和 `![[` 媒体，最多 8 条，按前缀、修改时间、字母排序（`frontend/app.js:1816-1891`）。
- 列表/引用/Task 的 Enter 续行、Tab 缩进、粘贴图片、拖拽 `.md`/媒体、任务框点击回写源码等，都是手写在 textarea 上的编辑增强（`frontend/app.js:1269-1333, 3217-3451, 4560-4665`）。
- 内容格式是“GFM + YAML frontmatter + Obsidian 风格 wikilink + 图片尺寸 + callouts + Mermaid/MathJax”。这使它对 Obsidian/GitHub 用户比较友好，但也意味着解析规则分散在前后端两套代码里。

这个架构的优点是**源码永远是真相、没有富文本状态、保存/导出简单**；缺点是所有编辑能力都要自己补，且一个 9568 行的 `app.js` 会越来越难维护。

### 2.4 同步/离线模型、冲突处理、版本

NoteDiscovery 的同步模型是“浏览器在线、服务器文件为真相”：

- 没有本地笔记数据库，也没有离线编辑队列。Service Worker 只预缓存 `logo.svg`、`favicon.svg`、`app.js` 三个静态资源；`/api/` 请求永远走网络，其他请求 network-first 再回 cache（`frontend/sw.js:11-66`）。README 里的“Offline always works”应理解为“局域网内服务器可达时可用”，不是“断网可编辑”。
- 自动保存会把整个 `noteContent` POST 到 `/api/notes/{path}`；请求体可以带 `base_hash`（`frontend/app.js:6173-6179`）。
- 服务端用 SHA-256（统一换行符）计算磁盘内容的 hash；如果客户端带来的 `base_hash` 与当前磁盘不一致，返回 409，不写入（`backend/main.py:1565-1572, 1625-1636`）。前端弹出“覆盖 / 重新加载”对话框；覆盖时把服务端返回的新 hash 作为 base 再发一次（`frontend/app.js:6181-6204, 6250-6265`）。这是非常值得借鉴的**乐观并发控制**。
- 如果客户端不传 `base_hash`，就退回 last-write-wins（`backend/main.py:1629-1636`）。这是为旧客户端/脚本保留的兼容路径，但也意味着 API 默认不是安全的。
- 客户端用 `isSaving` + `_saveQueued` 串行化保存，避免自己的两个请求互相触发 409（`frontend/app.js:6160-6167, 6241-6246`）。
- 外部修改只能在下一次 GET 时被发现；没有后台文件监听。切换笔记会重新 GET，所以通常能拿到最新版本；如果一直停在当前页，磁盘被外部改掉后，下一次自动保存才会 409。
- 没有版本历史、没有回收站；撤销只在当前浏览器 session 的 JS 栈里，刷新即失去。分享链接只读，不能作为版本快照（`documentation/SHARING.md:105-110`）。

这里有一个实现细节值得注意：`save_note` 直接 `open(..., 'w')` 写目标文件，不是临时文件 + 原子 rename（`backend/utils.py:714-740`）。进程崩溃/磁盘满时可能留下截断文件；对“文件是唯一真相”的系统，这是应该补上的。

### 2.5 安全与隐私：认证、加密、分享

NoteDiscovery 的安全模型是“单用户 + 可选密码 + 可选 API key”：

- 认证默认关闭；默认密码 `admin`；`secret_key` 默认是占位符（`config.yaml:47-75`）。启动时会把明文密码 bcrypt hash，并删除配置里的明文（`backend/main.py:127-148`）。
- 登录成功后 `request.session.clear()` 再写入 `authenticated`，防止 session fixation；SessionMiddleware 默认 7 天、`same_site='lax'`（`backend/main.py:282-290, 719-733`）。
- API 同时支持 `Authorization: Bearer <api_key>` 和 `X-API-Key`，用 `secrets.compare_digest` 做常量时间比较；所有 `/api` 路由统一挂 `require_auth`（`backend/main.py:596-677, 759-768`）。
- 页面路由也统一挂认证；401 时 API 返回 JSON，页面 303 到 `/login`（`backend/main.py:565-589`）。
- 路径安全：所有文件操作都 `resolve()` 后检查是否在 notes_dir 内；媒体接口还校验扩展名白名单（`backend/utils.py:226-243`；`backend/main.py:900-928`）。
- 上传有按类型的体积上限：图片 10MB、音频 50MB、视频 100MB、PDF 20MB、Markdown 10MB（`backend/main.py:298-310`）。
- 分享 token 是 16 位随机字符串（字母数字 + `_-`），每个笔记最多一个 token；自定义 slug 3–64 位、大小写不敏感去重；shared note 只读、无过期时间；撤销即删除（`backend/share.py:23-60, 137-141, 206-263, 323-354`；`documentation/SHARING.md:14-31, 63-110`）。
- `.share-tokens.json` 存在 vault 根目录，是**明文 JSON**，token 没有 hash、没有 scope、没有 expiry；任何能读文件的人都能拿到有效分享链接。zip 导出会排除 dotfiles，所以不会把 token 带出去（`documentation/API.md:608-614`）。
- CORS 默认 `["*"]`；当 origin 为 `*` 时主动关闭 credentials，避免 `* + credentials` 的 credentialed 读取（`backend/main.py:232-245`）。
- 没有多用户、没有 ACL、没有加密 at rest、没有审计日志、没有 CSRF token；`same_site=lax` 和“写操作基本用 POST/DELETE”降低了风险，但不足以支撑公网多租户。插件是任意 Python 代码，权限等同应用（`documentation/PLUGINS.md:1-24`）。MCP HTTP 用同一套 API key，等于给 AI 完整的读写权限（`documentation/MCP.md:90-151`）。

它的安全定位是“homelab 单用户”，README 也反复警告不要直接暴露公网（`README.md:314-344`；`documentation/AUTHENTICATION.md:104-125`）。

### 2.6 导入/导出/互操作性

NoteDiscovery 的导入很轻，导出比 flatnotes 强很多：

- 导入：拖拽 `.md` 文件会在当前笔记所在文件夹创建新笔记，并在光标处插入 `[Name](path)` 链接；文件名冲突追加时间戳（`frontend/app.js:3340-3401`）。媒体拖拽/粘贴上传到 `_attachments`。**没有 vault/zip 导入，也没有 Obsidian/Notion 专用 importer**；互操作靠兼容语法。
- 单篇 HTML 导出：内联主题 CSS、图片转 base64、保留 MathJax/Mermaid/Highlight.js；下载模式默认用 CDN 资源，打印预览和分享页才用本地 vendor 资源（`backend/main.py:1900-1947`；`backend/export.py:428-485`）。所以“下载的 HTML 完全离线可用”这个宣传要打个折扣：没有网络时 marked/MathJax/Mermaid/Highlight 可能加载失败；分享页和打印预览才是真正本地资源。
- 文件夹/整个 vault zip：原样打包，跳过 dotfiles、dot-directories、symlink，已压缩媒体不再 deflate，默认上限 500MB；demo 模式禁用（`backend/main.py:1747-1800`；`documentation/API.md:588-625`）。
- 分享页：服务端生成 standalone HTML，使用创建分享时保存的主题；只读，不暴露编辑 API（`backend/main.py:2314-2380`）。
- API / MCP：REST API 覆盖 notes、folders、media、search、tags、templates、graph、sharing、plugins；MCP 把这些能力暴露给 AI（`documentation/API.md:1-1009`；`documentation/MCP.md:1-151`）。

它的互操作强在“读得懂 Obsidian 风格语法 + 能导出 HTML/zip + 有 API”；弱在“没有真正的导入管线”和“下载 HTML 依赖 CDN”。

### 2.7 UX/导航模式

NoteDiscovery 的 UX 是三栏知识库：

- 左侧 icon rail + 可折叠/可调宽 sidebar；面板包括 Files、Search、Tags、Outline、Backlinks、Shared、Settings（`frontend/index.html:1132-1290`）。
- `Ctrl/Cmd+Alt+P` 打开 Quick Switcher，输入即过滤所有笔记；`Ctrl/Cmd+Alt+N/F` 新建笔记/文件夹；`Ctrl/Cmd+Alt+Z` 进入 Zen Mode（`documentation/FEATURES.md:357-405`）。
- 树支持文件夹展开/折叠、拖拽移动、重命名、删除、排序、隐藏 `_` 系统文件夹；收藏置顶（`documentation/FEATURES.md:34-42, 107-115`）。
- 编辑/分栏/预览三模式，视图偏好记忆；大纲实时更新、点击跳转；backlinks 显示上下文和行号；graph 区分 wikilink/Markdown link（`documentation/FEATURES.md:61-105, 125-130`）。
- 深链接 `/folder/note`、`?search=term` 刷新安全；复制链接按钮；最后编辑时间；分享 icon；移动端有独立的移动 sidebar 和底部导航（`documentation/FEATURES.md:107-115`；`frontend/index.html:3844-3905`）。
- 乐观 UI：新建/删除/重命名笔记和文件夹时先改本地树，失败再 silent resync（`frontend/app.js:2722-2796, 6304-6309, 6371-6407`）。笔记列表首屏有 800ms 延迟才显示 loading overlay，避免快速加载时闪烁（`frontend/app.js:1696-1720`）。
- 分享 modal 支持随机/自定义 slug、QR、复制、撤销；分享状态在树里用小图标标记（`documentation/SHARING.md:1-85`；`frontend/app.js:8599-8634`）。

值得借鉴的是**面板化导航 + Quick Switcher + 乐观树操作 + 分享状态可见**。需要警惕的是功能面板过多、单文件前端过大，以及移动端与桌面端两套导航的维护成本。

### 2.8 规模与性能技术

NoteDiscovery 在“单进程 + 纯文件”约束下做了不少性能工程：

- 进程内 `NoteIndex` 统一维护 notes、folders、tags 正反向索引、links 正反向索引、wikilink token、倒排搜索词；全部读写用一把 `RLock` 保护（`backend/note_index.py:80-105`）。
- 首次扫描 10K 笔记约 1–3 秒；标签/链接抽取在文件数 ≥50 时用最多 8 个线程并行（`backend/note_index.py:1-10, 29-32`；`backend/utils.py:407-424`）。
- 搜索索引懒构建：第一次 `/api/search` 才读取所有笔记建倒排；之后保存时增量更新。搜索先用倒排缩小候选，再逐个文件做 substring 匹配和 snippet 提取（`backend/note_index.py:146-180, 495-529`；`backend/utils.py:799-870`）。
- 扫描结果有 fingerprint，输入没变时 `bulk_set` 直接短路；每个文件有 mtime 级 tag/link 缓存；`scan_notes_fast_walk` 还有 1 秒 TTL 的内存缓存（`backend/note_index.py:182-216, 887-897`；`backend/utils.py:151-180, 183-223`）。
- 静态资源用版本化 URL + `Cache-Control: immutable`；Mermaid 约 650KB，首次使用时才动态 import；GZip 只压 ≥1000 字节的响应（`backend/main.py:425-449`；`frontend/app.js:6458-6474`）。
- zip 打包用同步 def（FastAPI 放到线程池），避免阻塞事件循环；已压缩媒体 store 不 deflate（`backend/main.py:1761-1767`；`documentation/API.md:608-613`）。
- API 支持 `limit/offset` 分页，但前端 `loadNotes()` 仍然一次拉全量 `/api/notes`（`backend/main.py:1519-1562`；`frontend/app.js:1696-1713`）。

局限也很明显：搜索仍然要读候选文件；不搜索标题/文件名（文档明确说 content-only）；索引只在单进程内存，重启重建；没有文件 watcher，外部修改靠请求时扫描；`save_note` 不是原子写；前端全量加载在 10 万篇时会出现瓶颈。

### 2.9 NoteHack 应该 adopt / adapt / reject

**Adopt**

- **自动保存 + `base_hash` 乐观并发 + 409 覆盖/重载提示**。这是三个项目里最直接可复用的“防丢数据”模式。
- **进程内统一索引**：notes、tags、links、backlinks、graph、search 共享一份扫描结果，避免每个功能各扫一遍。
- **懒构建搜索索引 + fingerprint 短路 + mtime 缓存 + 并行抽取**，是低资源自托管产品的实用性能组合。
- **面板化导航 + Quick Switcher + 乐观树操作 + 分享状态可见**。
- **standalone HTML / zip 导出**、打印预览、分享 token、QR、自定义 slug 的产品化细节。
- **插件 hook 的“observe/transform”约定**：明确 subject、类型校验、异常隔离、返回 `None` 保持原值，避免一个坏插件拖垮请求（`backend/plugins.py:27-53, 94-159`）。

**Adapt**

- 把“路径 = 主键”改为 **稳定 ID + 路径可改**；链接、分享、版本都引用 ID，迁移路径时统一重写引用。
- 把 `base_hash` 从“整文件 hash + 覆盖/重载二选一”升级为 **三路合并或块级合并**，至少保留冲突副本，而不是让用户二选一。
- 把内存索引换成 **SQLite FTS5（或 Tantivy）+ 持久化索引 + 后台增量任务**；进程重启不必全量重建，支持多 worker。
- 把“下载 HTML 依赖 CDN”改成 **默认内嵌/打包所有 runtime 资源**，或者明确区分“分享页（本地资源）/下载页（CDN）”并在 UI 标注。
- 把 PWA 从“壳缓存”升级成真正的 **本地优先编辑**：IndexedDB 草稿/笔记缓存 + outbox + 后台同步；否则不要宣传 offline。
- 认证从单密码升级为 **多用户 + 每笔记 ACL + 安全分享 token（hash、过期、scope、可撤销）**。

**Reject**

- 默认关闭认证、默认 `admin`、默认占位 secret。
- 明文 `.share-tokens.json`、无过期/无 scope 的分享 token。
- 路径作为唯一身份；重命名不更新引用。
- 无版本历史/回收站；撤销只存在浏览器内存。
- 直接 `open('w')` 覆盖写。
- 单文件 9.5K 行 Alpine 前端；功能继续堆进去会不可维护。
- “content-only search 却宣称完整搜索”；标题/文件名必须可搜。
- 依赖 CDN 的“离线导出”。

---

## 三、Livebook：文档 / 会话分离、实时协作、可部署应用

### 3.1 核心哲学、定位与关键取舍

Livebook 不是笔记软件，而是“写交互式、可协作代码 notebook”的 Web 应用（`README.md:6-24`）。它的核心卖点：

- Code notebook + Markdown + 按需执行；CodeMirror 富编辑器；Kino 交互输出；Smart cells；可复现（执行顺序、依赖、状态/stale 标记）；多人实时协作；去中心化/可自托管；`.livemd` 纯文本、可版本控制；自定义 runtime；可部署成 app（`README.md:6-24`）。
- `.livemd` 是 Markdown 的子集，支持 Mermaid、KaTex，能和 Git 配合（`README.md:22`）。

关键取舍是：**为了“可执行、可复现、可协作”，接受复杂的 runtime、会话进程、OT、权限 stamp 和较高的部署/使用门槛**；同时它明确不是通用知识库：没有标签/文件夹/backlinks 这类笔记组织，安全模型也假定“能访问实例的人可以在机器上执行任意代码”（`README.md:162-170`）。

### 3.2 数据模型与组织

Livebook 把“文档”和“会话”分成两层，这是它最值得学习的建模：

- `Livebook.Notebook` 是纯文档：`name`、`setup_section`、`sections`、`leading_comments`、`persist_outputs`、`autosave_interval_s`、`default_language`、`app_settings`、`hub_id`、`hub_secret_names`、`file_entries`、`quarantine_file_entry_names`、`teams_enabled`、`deployment_group_id`（`lib/livebook/notebook.ex:14-30`）。
- 文档由 section + cell 组成；section 可以有 `parent_id`，形成 branching section（`lib/livebook/notebook/section.ex:1-27`）。
- Cell 有三种：Markdown（source）、Code（source/outputs/language/reevaluate_automatically/continue_on_error/output_size）、Smart（source/attrs/chunks/editor/js_view，UI 生成代码，可随时 takeover 成 Code）（`lib/livebook/notebook/cell.ex:13-18`；`lib/livebook/notebook/cell/code.ex:1-52`；`lib/livebook/notebook/cell/markdown.ex:1-24`；`lib/livebook/notebook/cell/smart.ex:1-62`）。
- File entry 有三种：`attachment`（和 notebook 一起放在 `files/`）、`file`（任意文件系统上的绝对链接，如 S3）、`url`（在线 URL）。导入时 `file` 类型会被放进 quarantine，必须用户显式授权；stamp 会持久化这个授权（`lib/livebook/notebook.ex:57-82`）。
- `Session.Data` 在 Notebook 之外叠加所有 ephemeral 状态：file、dirty、section_infos/cell_infos、runtime、runtime_status、clients_map、users_map、secrets、hub_secrets、mode、app_data 等（`lib/livebook/session/data.ex:1-79`）。文档可以保存/传输；会话状态不持久化。

这个分层让 Livebook 可以同时支持“打开文件编辑”“从 URL 导入”“部署 app”“多人协作”，而不会把运行时状态污染进 `.livemd`。

### 3.3 编辑器架构与内容格式

Livebook 的编辑器是 **Phoenix LiveView + CodeMirror 6 + 服务端权威 OT**：

- Markdown cell 在服务端渲染为 LiveView 组件；Code cell 通过 JS hook 挂 CodeMirror 6，支持 Elixir/Erlang/Python、补全、inline docs、格式化、doctest、signature help 等（`README.md:8-12`；`assets/js/hooks/cell_editor/live_editor.js:1-40`；`assets/js/hooks/cell_editor/live_editor/codemirror/*`）。
- 协作编辑以“每个 cell 的 source”为单位维护 revision 和 delta 列表；客户端发送 delta + selection + revision，服务端 `apply_cell_delta` 在 Session GenServer 中线性化，并用 OT 对未确认的 delta 做 transform（`lib/livebook/session.ex:589-620`；`lib/livebook/session/data.ex:2126-2167`）。
- 客户端 `CollabClient` 维护 inflight/buffer delta、远端 selection、peer 列表；收到远端 delta 时先与本地未确认 delta 做 transform，再应用；没有本地输入时定期上报 revision，让服务端回收旧 delta（`assets/js/hooks/cell_editor/live_editor/collab_client.js:7-35, 100-116`；`assets/js/hooks/cell_editor/live_editor/codemirror/collab.js:1-143`）。
- 服务端按“最慢客户端”保留必要 delta，`purge_deltas` 只保留 `revision - min_client_revision` 条（`lib/livebook/session/data.ex:2362-2380`）。
- LiveView 挂载时会把每个客户端副本里的 cell source prune 掉，只把 source 推给对应编辑器，避免每个客户端在内存里保留两份大文本（`lib/livebook_web/live/session_live.ex:2187-2216`）。

`.livemd` 格式是 Livebook 的“无损纯文本容器”：

- 规则：H1 是 notebook 名；H2 开始新 section；Elixir/Erlang/Python 代码块是 Code cell；相邻普通 Markdown 块合并为 Markdown cell；`<!-- livebook:json -->` 注释可以出现在任何地方，存放 metadata、smart cell、`force_markdown`、`break_markdown`、output、stamp 等（`lib/livebook/live_markdown.ex:1-81`）。
- 导出时按规则生成 Markdown；cell metadata 只在非默认值时写出；Smart cell 用 `livebook_object: "smart_cell"` + base64 attrs；输出可选写入，用 `{"output":true}` 标记（`lib/livebook/live_markdown/export.ex:82-105, 147-205, 244-291`）。
- 导入是“宽容的”：多个 H1 会全部降级并给出 warning；H1 不在顶部会移动；任意 Markdown 都能导入，只是语义按规则推断（`lib/livebook/live_markdown/import.ex:36-91, 149-173`）。
- stamp 放在文件末尾，记录 `offset` 和加密 token；校验时用 offset 把“被签名的源”与“stamp 本身”分开（`lib/livebook/live_markdown/export.ex:368-400`；`lib/livebook/live_markdown/import.ex:655-700`）。

这个格式的启示是：**纯文本不意味着只能存“扁平 Markdown”**。通过 HTML 注释承载结构化元数据，可以在保持 Git diff 可读、任意 Markdown 编辑器可打开的同时，做到接近无损的 round-trip。

### 3.4 同步/离线模型、冲突处理、版本

Livebook 的协作是**在线、服务端权威、会话内存态**：

- 没有离线编辑；浏览器通过 LiveView WebSocket 连到 Session 进程。服务器重启后，未保存到文件的修改会丢失；默认每 5 秒 autosave 到文件或 autosave 目录（`lib/livebook/notebook.ex:185-190`；`lib/livebook/session.ex:2876-2929`）。
- 如果 notebook 没有显式文件，会保存到 `autosave_path` 下的按日期/时间/session id 生成的默认路径；一旦用户另存为，会删除之前的默认文件（`lib/livebook/session.ex:2917-2961`）。
- 对非本地文件系统（如 S3/Git），PersistenceComponent 默认把 `autosave_interval_s` 设为 nil，也就是不自动保存，需要用户显式保存（`lib/livebook_web/live/session_live/persistence_component.ex:18-33`）。
- `FileGuard` 按文件资源标识加锁，防止两个 Session 同时写同一个文件；本地文件用进程内 map，非本地文件还用 `:global.set_lock` 做跨节点锁（`lib/livebook/session/file_guard.ex:1-96`；`lib/livebook/session.ex:1015-1034, 1496-1516`）。
- 外部修改不会自动合并；提供 `sync_file`：读取文件、与上次保存的 md5 比较、解析 `.livemd`，再用 `DataSync.sync` 把“文件 notebook”与“当前会话 notebook”做结构 diff，生成 insert/delete/move/update 操作，逐条 apply（`lib/livebook/session.ex:793-803, 1635-1661`；`lib/livebook/session/data_sync.ex:1-110, 468-471`）。这是“结构化 diff 同步”，不是通用的三方文本 merge。
- 版本历史：没有内置的 notebook 版本历史/回收站。它依赖文件系统/Git/S3 的版本能力；`.livemd` 是文本，适合 VCS（`README.md:22`）。应用部署有 version/zero-downtime/multi-session 概念（`lib/livebook/app.ex:14-55`；`lib/livebook/notebook/app_settings.ex:106-138`）。
- 删除的 cell 会进入当前 session 的 Bin，可以搜索和恢复；这是 session 级回收站，不是持久版本（`lib/livebook_web/live/session_live/bin_component.ex:1-70`；`lib/livebook/session/data.ex:133-139`）。
- CodeMirror 自带 per-cell undo/redo；没有跨 cell 的全局历史。

因此 Livebook 的“冲突处理”分两层：**同一 session 内用 OT 保证顺序一致；跨 session/文件用 FileGuard 阻止并发，用 sync_file 做手动结构同步**。它没有解决“两个离线副本各自修改后再合并”的问题。

### 3.5 安全与隐私：认证、加密、分享

Livebook 的安全模型非常特殊：**执行代码就是产品功能，因此实例本身就是高权限环境**。

- README 明确写：任何能访问 Livebook 的人都能访问机器上的任意文件并执行任意代码；所以默认只绑定 `127.0.0.1`，生产模式启动时生成 token，只有带 token 的 URL 才能访问（`README.md:162-170`）。
- 认证分三层：instance authentication（`LIVEBOOK_IDENTITY_PROVIDER`：basic auth、Cloudflare、Google IAP、Tailscale、custom）、admin authentication（token 或 `LIVEBOOK_PASSWORD`，密码至少 12 位）、deployed notebook passwords（`docs/authentication.md:1-29`）。
- `AuthPlug` 用 `store(conn, mode, value)` 把 secret 的 SHA-256 存进 session，key 带端口和 mode；校验用 `Plug.Crypto.secure_compare`；token 模式支持 `?token=` 登录后重定向去掉 query；密码模式走 `/authenticate` 表单（`lib/livebook_web/plugs/auth_plug.ex:13-101`；`lib/livebook_web/controllers/auth_controller.ex:16-48`）。session 在登录时 `configure_session(renew: true)`，降低 fixation 风险（`lib/livebook_web/plugs/auth_plug.ex:28-33`）。
- 用户不是账号：`Livebook.Users.User` 是 ephemeral 的协作身份，只有 name/email/avatar/hex_color/access_type/groups/payload；`access_type` 只有 `:full` 和 `:apps`（`lib/livebook/users/user.ex:1-39`）。Docker 文档明确说“authoring notebooks 必须单用户，因为配置存在磁盘上并被所有用户共享”（`docs/deployment/docker.md:5-7`）。
- 部署 app 有 `public` / `protected` 两种 access type；protected 默认生成随机密码，密码至少 12 位；app auth token 是 `SHA-256(password)`，存在浏览器 localStorage，通过 LiveView connect params 回传校验（`lib/livebook/notebook/app_settings.ex:8-61, 106-117`；`lib/livebook_web/live/hooks/app_auth_hook.ex:1-40, 121-139`）。普通 notebook 没有“公开只读链接”这一层；要给别人看，通常是把 notebook 部署成 app，或让对方在同一实例里协作。
- Notebook stamp 是“能力清单 + 完整性签名”：导出时把 `hub_secret_names`、quarantined file entries、protected app password 等 metadata 用 XChaCha20-Poly1305（AEAD）加密，并连同 `offset` 写入文件末尾；导入时校验失败就撤销 secrets/remote files 的访问，并给出 warning（`lib/livebook/stamping.ex:14-35`；`lib/livebook/hubs/personal.ex:235-247`；`lib/livebook/live_markdown/import.ex:655-700`）。
- Teams 在此基础上再加一层 RSA 签名：本地用 teams key 加密 metadata，Teams server 用组织私钥对 token 签名；成员用公钥验证，因此伪造 stamp 需要同时拿到本地 key 和 Teams 服务端签名（`lib/livebook/hubs/team.ex:146-180`；`docs/stamping.md:11-23`）。
- Teams secrets 在客户端用 teams key 加密后再上传，Teams server 没有 key，不能读明文（`lib/livebook/teams/requests.ex:44-64`；`lib/livebook/teams.ex:109-132`）。
- Secret 在运行时以 `LB_<NAME>` 环境变量注入；Hub secret 会同步到 session，代码 cell 可以直接读取（`lib/livebook/session.ex:2843-2860`）。这很方便，但也意味着“能执行代码”与“能读 secret”几乎是等价的，权限边界必须靠 stamp/quarantine 和实例隔离来守。
- 但 notebook 正文默认不加密；stamp 只加密 metadata/permissions。安全依赖“实例可信 + HTTPS + 强认证 + 代码审查”，不是多租户隔离。runtime 也不是 sandbox：standalone runtime 是独立 VM，但仍是 Livebook 的可信 peer（`docs/runtime.md:1-7`）。

这是三个项目里最成熟的“分享/权限”设计：**分享不是给一个裸 token，而是给一份可验证的能力声明**。对 NoteHack 的分享/插件权限模型非常有参考价值。

### 3.6 导入/导出/互操作性

Livebook 的导入/导出围绕 notebook 和 app：

- 打开方式：从 storage（本地/S3/Git 等 FileSystem）、从 URL、从 source 粘贴、上传文件；URL 导入会重写 GitHub/Gist 的 HTML URL 为 raw URL，并校验 content-type 是 text/plain、text/markdown 或 octet-stream（`lib/livebook/notebook/content_loader.ex:1-73`；`lib/livebook_web/live/open_live.ex:71-116, 167-181`）。
- 任意 Markdown 都能按 `.livemd` 规则导入；`.livemd` 是首选格式。
- 导出：`.livemd`（可选包含 outputs）和 `.exs`（可直接 `iex --dot-iex` 运行）；导出通过 SessionController 的 `download_source`（`lib/livebook_web/controllers/session_controller.ex:41-67`；`lib/livebook/notebook/export/elixir.ex:1-100`）。
- 附件：`files/` 目录随 notebook 走；file entry 可以指向外部 FileSystem 或 URL；导入时外部 file entry 进 quarantine。
- 部署：notebook 可以部署成 app，生成 Dockerfile/容器，支持 Fly.io/Kubernetes runtime、Teams deployment group、zero-downtime、multi-session（`lib/livebook/app.ex:1-55`；`lib/livebook/apps.ex:160-240`；`docs/runtime.md:78-94`）。
- 没有 HTML/PDF 导出，也没有通用笔记格式导入；它的互操作是“Markdown + Git + 容器”，不是“笔记应用生态”。

### 3.7 UX/导航模式

Livebook 是三个项目里最“键盘驱动”的：

- 首页有 Starred notebooks、Running sessions、Learn notebooks、内存/版本提示（`lib/livebook_web/live/home_live.ex:1-140`）。
- Open 页有 From storage / From URL / From source / File upload 四个 tab，最近打开的 notebooks 列表（`lib/livebook_web/live/open_live.ex:71-156`）。
- Notebook 页面围绕 section/cell：可折叠 section、cell 上下移动、outline、users、secrets、runtime、bin 面板；cell 有 stale/fresh/evaluated 状态、执行队列、输出折叠/宽窄、presentation/zen/custom view（`lib/livebook_web/live/session_live.ex`；`lib/livebook_web/live/session_live/render.ex`）。
- 键盘有“navigation mode / insert mode”两套，类似 Vim：`j/k` 上下 cell、`i` 进入编辑、`n/m` 插入 Code/Markdown、`e e` 执行、`e a` 执行所有 stale、`s b` 打开 bin、`?` 帮助；通用快捷键包括 `Ctrl/Cmd+Enter` 执行、`Ctrl/Cmd+S` 保存（`lib/livebook_web/live/session_live/shortcuts_component.ex:1-180`）。
- App dashboard 展示部署的 app、public/protected 状态、session 数、启动者、状态；多 session app 可以列出并进入不同 session（`lib/livebook_web/live/apps_live.ex:180-230`；`lib/livebook_web/live/app_live.ex:20-130`）。
- “Learn” 内置教程 notebook，降低首次使用门槛（`lib/livebook/notebook/learn.ex`；`lib/livebook_web/live/learn_live.ex`）。

值得借鉴的是**文档结构（section/cell）与命令模式**、**stale 状态可视化**、**输出是一等公民**、**Bin**、**app dashboard**。需要警惕的是两套键盘模式的学习成本，以及面板/功能过多对普通笔记用户的压迫感。

### 3.8 规模与性能技术

Livebook 的性能模型是“每个 notebook 一个 Session 进程，每个 runtime 一个独立 VM/节点”：

- Session 是 GenServer，负责线性化所有操作；客户端各自持有 Data 副本，服务端广播 operation，客户端本地 apply，保证顺序一致（`lib/livebook/session/data.ex:1-18`）。
- 每个 notebook 默认启动一个 standalone Erlang VM；也支持 attached node、Fly.io、Kubernetes Pod、embedded runtime（`docs/runtime.md:9-94`）。这带来隔离和依赖隔离，但内存/启动成本高。
- 协作只保留必要 delta；客户端没有输入时定期上报 revision；LiveView 挂载时 prune cell source；输出也可以 prune（`lib/livebook/session/data.ex:2362-2380`；`lib/livebook_web/live/session_live.ex:2187-2216`）。
- 保存是异步 Task，避免阻塞 Session；写入后记录 md5，防止 file watcher/重复 sync 造成自触发（`lib/livebook/session.ex:2876-2895, 1635-1661`）。
- 静态资源/JS view 有 ETag、304、永久缓存、gzip 传输；文件系统协议支持 chunked write、stream read、etag（`lib/livebook_web/controllers/session_controller.ex:69-150`；`lib/livebook/file_system.ex:1-180`）。
- 支持 clustering（`LIVEBOOK_CLUSTER`），但 session 状态仍在单节点内存；app 可以 multi-session/多副本部署（`README.md:221-227`；`lib/livebook/app.ex:1-55`）。
- 这不是“十万笔记”的架构，而是“几十个并发 notebook session、每个 session 少量协作者”的架构。session 进程和 runtime 是天然瓶颈，但也是隔离边界。

### 3.9 NoteHack 应该 adopt / adapt / reject

**Adopt**

- **Document / Session 分离**：持久化的笔记文档 vs 运行中的编辑会话/协作状态/临时 presence/undo。NoteHack 即使不做代码执行，也应该把“保存的文档”和“当前编辑会话”分开。
- **纯文本容器 + HTML 注释元数据**：让 Markdown 仍然可读、可 diff，同时承载 block ID、权限、分享、插件状态等结构化信息。比把应用状态塞进 `.share-tokens.json` 更干净。
- **OT/CRDT 的工程细节**：revision、delta、inflight/buffer、ack、selection transform、按最慢客户端回收 delta；即使最终选 CRDT，这些边界条件也值得学习。
- **FileGuard / 单写者锁**：在实现实时协作前，先用文件/文档级锁避免两个 session 互相覆盖。
- **Stamp / quarantine / capability**：分享链接、插件、外部文件访问都可以用“签名/加密的能力声明 + 导入时隔离 + 用户显式授权”来表达。
- **键盘优先 + cell/section 结构 + Bin + stale 状态 + app dashboard**。
- **FileSystem 抽象**：本地/S3/Git 统一协议，为未来多后端留出空间。

**Adapt**

- 不要把 OT 直接搬到一个通用笔记产品上。OT 对“单 cell 纯文本”很合适，但笔记有 block、附件、标签、数据库视图；用 **Yjs/Automerge 之类的 CRDT** 或 block-level 操作日志更稳。若团队没有分布式编辑经验，先做“单写者 + presence + 乐观并发”，不要一开始就上实时协作。
- 不要把 notebook 正文默认加密和 stamp 混淆。NoteHack 若需要隐私，应该做 **内容加密 + 密钥管理**，而不只是加密 metadata。
- 不要复制“所有能访问实例的人都能执行代码”的信任模型。NoteHack 如果做插件/AI，必须 sandbox/权限声明，不能默认 `full access`。
- 不要把单用户磁盘配置当成多用户配置。NoteHack 需要 per-user workspace、ACL、审计。
- 不要复制 Livebook 的完整 runtime 复杂度；只借“会话/文档分离”和“操作日志”的思想。

**Reject**

- 在通用笔记产品中默认执行任意代码。
- 无持久化 op log、只靠内存 session 的协作；服务器重启就丢未保存状态。
- 没有内置版本历史、只依赖外部 Git。
- 单用户配置 + 全局 secret + 无 ACL。
- 为了“纯文本”把结构塞进难以维护的隐式规则；需要明确的 schema/version/migration。
- 让用户必须学习 Vim 式双模式才能高效使用。

---

## 四、横向对比与 NoteHack 的路线建议

### 4.1 一张表

| 维度 | flatnotes | NoteDiscovery | Livebook |
|---|---|---|---|
| 存储单位 | 单层 `.md` + 全局 attachments | 目录树 `.md` + 每层 `_attachments` + 模板/绘图 | `.livemd` 文档 + `files/` + 外部 FileSystem |
| 身份 | 标题 = 文件名 = URL | vault 相对路径 = 身份 | notebook file + cell/section ID |
| 编辑器 | TOAST UI，Markdown/WYSIWYG | 原生 textarea + marked 预览 | CodeMirror 6 + LiveView，服务端渲染 Markdown |
| 内容格式 | GFM + 内联 `#tag` + `[[wikilink]]` | GFM + frontmatter tags + wikilink + callouts + 图片尺寸 | Markdown 子集 + HTML 注释 JSON + code cells + outputs + stamp |
| 协作 | 无 | 无（单密码/单用户） | 实时 OT、多客户端、presence |
| 离线 | 无 | 仅 PWA 壳；API 必须在线 | 无；服务端会话 |
| 冲突 | 整文件覆盖，LWW | base_hash 409，覆盖/重载 | OT 同会话；跨文件 FileGuard + 手动 sync |
| 版本 | 无 | 无 | 无内置；依赖 Git/S3；app 部署有 version |
| 认证 | none/read-only/password/TOTP，单用户 | 可选单密码 + API key | token/password/ZTA + app password；单用户 authoring |
| 分享 | 无 | token 分享页，只读 | 部署 app，public/protected；Teams |
| 导出 | 无 | HTML、打印、zip、API/MCP | `.livemd`、`.exs`、Docker app |
| 规模 | 几千篇；Whoosh 单进程 | 1–10K 篇较舒适；内存索引 | 几十个并发 session；每 notebook 一个 runtime |

### 4.2 各自不可替代的贡献

**flatnotes 贡献的是“约束的力量”**：

- 用“文件是唯一真相 + 索引可丢弃”把系统复杂度压到最低；任何索引/数据库损坏都能重建，用户永远可以带着文件离开。
- 用“搜索即导航 + 标签 + 极简快捷键”证明：没有侧边栏树、没有 graph、没有 backlinks，也能做出高效的笔记体验。
- 用“read_only 不注册写路由”这种实现级安全，展示了极简系统如何减少攻击面。

**NoteDiscovery 贡献的是“单用户知识库的完整产品化”**：

- 在纯文件之上做出 folder tree、tags、wikilink、backlinks、graph、outline、favorites、templates、drawing、share、export、plugin、MCP，而且部署仍然是一个 Python 进程 + 一个数据目录。
- `base_hash` 409 + 覆盖/重载提示，是“没有 CRDT 也能防丢数据”的实用答案。
- 进程内统一索引 + 懒搜索 + fingerprint + mtime cache + 并行抽取，是低资源自托管产品的性能范本。
- 分享 token、QR、自定义 slug、分享状态、只读分享页，是“把分享做成产品”的细节范本。

**Livebook 贡献的是“文档/会话分离 + 实时协作 + 能力声明”**：

- Notebook 是纯文档，Session.Data 是运行时状态；两者分离让同一份文档可以被编辑、协作、导入、部署，而不会把运行时污染进文件。
- `.livemd` 证明“纯 Markdown + HTML 注释”可以做到接近无损的结构化 round-trip，同时保持 Git 友好。
- OT 的 revision/delta/ack/transform/purge、FileGuard、DataSync 的结构 diff，是一套完整的协作编辑工程教材。
- Stamp/quarantine/Teams 加密与签名，是“分享/插件/外部资源权限”最成熟的设计。
- 键盘优先、cell/section、stale 状态、Bin、app dashboard，是“专业工具”的 UX 范本。

一句话概括三者的互补关系：**flatnotes 提供“可迁移”的底线，NoteDiscovery 提供“单用户产品化”的中台，Livebook 提供“协作与能力治理”的上限。**

### 4.3 NoteHack 的目标架构建议

结合三者，NoteHack 可以采用“**文件优先的存储层 + 数据库索引 + 本地优先编辑 + 可选实时协作 + 能力式分享**”的组合，而不是复制任何一个项目。

**P0：先把“不丢数据、可迁移、找得到”做好**

1. **存储格式**：Markdown + YAML frontmatter；每篇笔记有稳定 `id`（ULID/UUID），标题、路径、别名可改；附件用内容 hash 命名（`sha256`）或 `attachments/<id>/`，避免重名和路径耦合。保留“导出就是一堆 .md + 附件”的硬约束。
2. **索引**：SQLite FTS5（或 Tantivy/Meilisearch）作为 derived index；索引 notes、title、content、tags、links、backlinks、graph；后台增量更新，支持分页；不要把索引放在 vault 里当唯一状态。
3. **编辑**：自动保存 + IndexedDB 本地草稿/离线缓存 + outbox；服务端用 `ETag`/`base_hash` 或版本号做乐观并发；冲突至少保留冲突副本，最好做三路合并/块级合并。
4. **版本**：每次保存生成轻量 snapshot（内容 hash + diff 或完整副本），提供历史/恢复/回收站；这是 NoteDiscovery 和 flatnotes 都缺的。
5. **导入/导出**：支持 zip/Markdown 文件夹导入、Obsidian 风格 frontmatter/wikilink、standalone HTML（资源内嵌）、zip 原始导出；导出必须真正离线可用。
6. **安全基线**：多用户、每笔记 ACL、HttpOnly session、CSRF、速率限制、审计；分享 token 必须 hash 存储、可过期、可设 scope、可撤销；不要默认密码。

**P1：把“知识库体验”做完整**

7. **UX**：搜索优先首页 + Quick Switcher + 文件树/标签/大纲/backlinks 面板；Edit/Split/Preview 三模式；键盘快捷键；移动端独立导航；乐观 UI；分享状态可见。
8. **格式**：GFM + frontmatter + wikilink + callouts + 图片尺寸 + Mermaid/MathJax；解析规则集中到一套共享 parser，前后端不要各写一遍。
9. **协作**：先做单写者锁 + presence + 评论/mention；需要实时编辑时再上 Yjs/Automerge，服务端持久化 CRDT/op log，支持断线重连和离线合并。不要一开始自研 OT。
10. **插件/AI**：采用 NoteDiscovery 的 hook 约定（observe/transform、类型校验、异常隔离），但加权限声明；MCP/API 用 scoped token，不要让 AI 默认拥有全库读写。

**P2：差异化**

11. **能力式分享**：借鉴 Livebook stamp，把分享链接/插件/外部文件访问做成签名或加密的 capability，导入时 quarantine + 显式授权；分享页可快照主题/版本。
12. **可选“可执行笔记”**：如果 NoteHack 要做代码/自动化，使用隔离 sandbox（容器/WASM），不要把 Livebook 的“实例即高权限”模型带进来。
13. **多后端 FileSystem**：本地/S3/WebDAV/Git 统一接口，但保持本地优先和可导出。

### 4.4 关键决策清单（按重要性）

- **身份**：稳定 ID，不要路径/标题当主键。否则重命名、分享、版本、同步都会付出代价。
- **真相**：Markdown 文件是真相，索引/数据库是可重建的派生层；但应用状态（分享、权限、版本）应进数据库，不要塞进 vault 的隐藏 JSON。
- **并发**：没有冲突检测的自动保存等于随机丢数据；`base_hash` 是最低配，三路合并/CRDT 是进阶。
- **离线**：要么真做（本地 DB + outbox + 冲突合并），要么明确说“需要连接服务器”；不要用 PWA 壳冒充离线。
- **安全**：单密码只适合 homelab；NoteHack 若面向团队/公网，必须多用户 + ACL + 安全 token + 加密。
- **导出**：导出的 HTML 必须自包含；zip 必须排除密钥/应用状态；导入必须能处理 Obsidian 风格语法。
- **性能**：搜索必须支持标题 + 正文 + 标签；索引要持久化/可增量；前端要分页/虚拟列表；不要每次请求全量扫描。
- **UX**：先做“搜索 + 树/标签 + 编辑/预览 + 快捷键”，再考虑 graph/插件/AI；功能面板过多会稀释核心体验。

### 4.5 明确的反模式

- 文件名/标题作为唯一 ID（flatnotes）。
- 整文件覆盖、无版本、无回收站（flatnotes/NoteDiscovery）。
- 默认关闭认证、默认 `admin`、默认 secret（NoteDiscovery）。
- 分享 token 明文落盘、无过期/无 scope（NoteDiscovery）。
- 下载 HTML 依赖 CDN 却宣传离线（NoteDiscovery）。
- 进程内索引、重启全量重建、单进程单锁（NoteDiscovery）。
- 单用户磁盘配置 + 全局 secret 冒充多用户（Livebook authoring）。
- 无持久化 op log 的实时协作（Livebook Session 内存态）。
- 通用笔记产品默认执行任意代码（Livebook）。
- 9K 行单文件前端、前后端两套 Markdown 解析规则（NoteDiscovery）。

### 4.6 结论

三个项目其实回答了三个不同的问题：

- flatnotes 回答“**如果只允许一个文件夹和搜索，笔记应用最少需要什么？**”——答案是：文件、索引、搜索、标签、草稿、认证。
- NoteDiscovery 回答“**在纯文件上，单用户知识库最多能做到多完整？**”——答案是：树、标签、双链、图谱、模板、绘图、分享、导出、插件、MCP，但要接受单进程/无版本/无真正多用户的边界。
- Livebook 回答“**如果文档要被执行、协作、部署，架构该怎么分层？**”——答案是：Document 与 Session 分离、纯文本容器承载结构、OT/操作日志、文件锁、能力 stamp、运行时隔离。

NoteHack 最好的路线不是“做一个功能更多的 NoteDiscovery”，而是：

> **用 flatnotes 的文件哲学保证可迁移性，用 NoteDiscovery 的产品完整度和乐观并发保证日常体验，用 Livebook 的 Document/Session 分离、版本化容器和能力声明保证未来能安全地扩展到协作、分享、插件与 AI。**

如果只能先做一件事：**把稳定 ID、自动保存 + 冲突检测、版本历史、真正的导入导出做扎实**。这三件事决定用户是否敢把知识库长期交给 NoteHack；其余功能都可以后加。
