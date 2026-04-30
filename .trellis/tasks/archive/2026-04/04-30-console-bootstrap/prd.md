# Smart Terminal Console: Bootstrap (Constraints + Research + Architecture)

> Status: **Brainstorm 完成；待用户最终确认执行计划即可开工。**
> Last update: 2026-04-30

---

## Goal

为嵌入式小项目搭建一个**极轻量**的智能终端管理上位机系统：
- **后端**：Node.js + `ws`，做 WebSocket 转发桥接（broker 模式，不存数据）
- **前端**：原生 JS + `xterm.js`，终端嵌入到 Web 界面（占部分区域，预留控件扩展）
- **下位机**：通过 4G 模组以 WebSocket 接入服务器
- 部署形式：Node 同时托管前端静态文件 + WS 服务（不能 file:// 直开）
- 设备规模：弹性（先按个位/十几台设计，预留扩展）

---

## Confirmed Decisions（用户已答）

| 项 | 决策 |
|---|---|
| 核心能力 v1 | 串口界面（终端控制台），后期加 LED 开关 / 多级电机控制 / 传感器实时图表 |
| 部署形态 | Web (B/S)，浏览器访问；前端可配置 WS 服务器地址+端口 |
| 后端 | **Node.js + ws**；接收消息后转发；尽可能轻量 |
| 下位机协议 | **WebSocket**（4G 模组接入） |
| 前端 | **原生 JS（无构建工具）**+ xterm.js + 极少依赖 |
| UI 布局 | 终端组件占页面一部分，预留控件区（按钮、滑块、图表）|
| 持久化 | **不存历史数据**（不需要数据库） |
| 团队 | 单人/小团队 |
| 提交规范 | Conventional Commits（已落） |
| 行尾 | LF（`.gitattributes` 已落） |

---

## Out of Scope (this MVP)

* 数据库、历史持久化、时序库
* 用户认证、RBAC、TLS/HTTPS（先内网/本地，按需后加）
* MQTT broker、消息队列
* 构建工具链（Vite/Webpack 等，遵循"原生 JS"轻量原则）
* 桌面打包（Tauri/Electron）
* 单元测试框架（v1 仅核心 relay 函数加少量纯函数测试，非强制）
* CI 复杂流水线（首版只 lint + 启动 smoke test）

---

## Architecture

```
                         ┌─────────────────────────────┐
[下位机 + 4G 模组]       │   Node.js Server (single)   │       [浏览器/工程师]
       │                 │                             │              │
       │  WebSocket      │   ┌─────────────────────┐   │  WebSocket   │
       └────────────────►│   │  WS Relay (/ws)     │◄──┼──────────────┘
                         │   │  - broadcast 转发    │   │
                         │   │  - 不持久化          │   │
                         │   └─────────────────────┘   │
                         │   ┌─────────────────────┐   │  HTTP GET
                         │   │  Static (/, /assets)│◄──┼──────────────
                         │   └─────────────────────┘   │     [浏览器]
                         │   ┌─────────────────────┐   │
                         │   │  Health (/healthz)  │   │
                         │   └─────────────────────┘   │
                         └─────────────────────────────┘
```

### 接口契约（清晰分明，按用户要求）

**HTTP**：
| Method | Path | 用途 |
|---|---|---|
| GET | `/` | 返回 `web/index.html` |
| GET | `/assets/*` | 静态资源（JS/CSS/字体） |
| GET | `/healthz` | 返回 `{ "status":"ok", "uptime":<sec>, "clients":<n> }` |

**WebSocket**：
- 路径：`/ws`
- 消息格式（JSON 文本帧）：
  ```json
  { "from":"device|web|server", "type":"data|cmd|status|error", "payload":<any> }
  ```
- 服务器行为：
  - 收到 client A 的消息 → 广播给除 A 外所有 client
  - 不缓存、不持久化
  - 维护内存中的 client 列表（用于 /healthz 计数）
- 心跳：客户端每 30s 发送 `{ "type":"ping" }`，服务器回 `{ "from":"server","type":"pong" }`

---

## Directory Layout (single-repo, 单包但前后端目录分离)

```
helmet-console/
├── server/                      # Node.js 后端
│   ├── src/
│   │   ├── index.js             # 启动入口 (HTTP + WS)
│   │   ├── ws-relay.js          # WS 转发核心逻辑
│   │   ├── static.js            # 静态文件服务
│   │   └── config.js            # 端口/路径/CORS 配置
│   ├── package.json             # 依赖：ws, sirv (静态托管)
│   ├── .eslintrc.cjs
│   └── README.md
│
├── web/                         # 前端 (原生 JS)
│   ├── index.html
│   ├── js/
│   │   ├── main.js              # 入口
│   │   ├── ws-client.js         # WebSocket 连接 + 重连
│   │   ├── terminal.js          # xterm.js 封装
│   │   └── config-panel.js      # 服务器地址端口面板
│   ├── css/
│   │   └── style.css
│   └── vendor/                  # xterm.js 等本地拷贝（避免 CDN 依赖）
│
├── docs/
│   ├── architecture.md          # 本架构图 + 数据流
│   ├── interface.md             # HTTP/WS 接口契约（详细）
│   └── deployment.md            # 部署手册
│
├── .editorconfig                # 统一缩进/LF/UTF-8
├── .prettierrc.json             # 格式化
├── .commitlintrc.json           # 提交规范校验
├── package.json                 # 根工作区（仅脚本聚合，可选）
└── （已有: AGENTS.md, .gitattributes, .trellis/, .claude/, .codex/, .agents/）
```

---

## Constraints First（约束先行，立刻落地）

| 类别 | 工具 / 规范 | 文件 |
|---|---|---|
| 编辑器配置 | `.editorconfig`：LF / UTF-8 / 2-space / final newline | `.editorconfig` |
| 代码风格 | Prettier（默认配置 + 单引号 + semi: true） | `.prettierrc.json`, `.prettierignore` |
| Lint | ESLint (`eslint:recommended`) | `server/.eslintrc.cjs` |
| 提交规范 | Conventional Commits + commitlint + simple-git-hooks | `.commitlintrc.json`, `package.json#simple-git-hooks` |
| 分支策略 | GitHub Flow：`main`（保护）← `dev` ← `feat/*` / `fix/*` | docs/contributing.md |
| 行尾 | LF（已落 `.gitattributes`） | ✓ |
| 文件编码 | UTF-8 (no BOM) | `.editorconfig` |
| CI（首版） | GitHub Actions：lint + node 启动 smoke test | `.github/workflows/ci.yml` |
| 部署 | `node server/src/index.js`；可选 PM2 ecosystem 文件 | `docs/deployment.md` |

> 工具选 **simple-git-hooks** 而非 husky，更轻量、零依赖（除自身）。

### 前端代码组织约束（用户明确要求）

* **HTML 只放结构**：`index.html` 不写内联 `<script>` 体（除模块入口 `<script type="module" src="...">`）和内联 `<style>` 块
* **JS 全部独立文件**：拆分到 `web/js/*.js`，按职责分模块（`main.js` / `ws-client.js` / `terminal.js` / `config-panel.js`）
* **CSS 全部独立文件**：拆分到 `web/css/*.css`（首版可单文件 `style.css`，后期按页面/组件拆）
* **第三方库**：放 `web/vendor/`（如 `xterm.js`、`xterm.css`），不通过 CDN 引入（保证离线可用）
* **HTML 引用方式**：`<link rel="stylesheet" href="/css/style.css">` + `<script type="module" src="/js/main.js"></script>`

---

## Execution Plan（分阶段，每阶段一次提交）

| Phase | 内容 | 验收 |
|---|---|---|
| **P1 约束先行** | `.editorconfig` / `.prettierrc` / `.commitlintrc` / 根 `package.json` / `docs/contributing.md` | `npx prettier --check .` 通过；commit 触发 commitlint |
| **P2 后端 MVP** | `server/`：HTTP 静态托管 + WS broadcast relay + healthz + 启动入口 | `node server/src/index.js` 启动；wscat 双连接广播验证 |
| **P3 前端 MVP** | `web/`：index.html + xterm 嵌入 + WS 客户端 + 配置面板（host/port） | 浏览器访问 127.0.0.1:8080，能连/断 WS，能收发消息显示在终端 |
| **P4 联调** | 用 wscat（或 mock 脚本）模拟下位机，验证转发链路 | 两侧消息互通 |
| **P5 文档** | `docs/architecture.md`、`docs/interface.md`、`docs/deployment.md`、根 `README.md` | 文档可独立读懂 |

**总代码预估**：后端 ~150 行；前端 ~200 行；配置 + 文档 ~400 行。

---

## Acceptance Criteria

- [ ] `.editorconfig` / Prettier / ESLint / commitlint 全部生效
- [ ] `node server/src/index.js` 一键启动（默认 :8080）
- [ ] 浏览器访问 `http://127.0.0.1:8080` 看到终端界面，可填入 WS 地址端口连接
- [ ] WS 客户端 A 发消息，客户端 B 立刻收到（广播验证）
- [ ] `GET /healthz` 返回客户端数量
- [ ] `npm run lint` 全绿
- [ ] README 描述如何启动、如何部署、接口文档链接

## Definition of Done

- 所有产出 UTF-8 / LF
- 关键决策落 ADR-lite（见下）
- 至少一次端到端联调通过
- 文档让一个新人能在 10 分钟内启动 + 理解架构

---

## Decision Log (ADR-lite)

### ADR-001: 后端选 Node + 原生 ws，不用框架
- **Context**：用户要求"尽可能轻量"，Node 服务只做 WS 中转
- **Decision**：直接用 `node:http` + `ws` 库，加 `sirv` 做静态托管。不引入 express/fastify
- **Consequences**：依赖极少（`ws` + `sirv`，约 5 个间接包）；扩展中间件需手写

### ADR-002: 前端选原生 JS，不用框架/构建工具
- **Context**：用户明确"原生 JS"
- **Decision**：HTML + ESM + xterm.js（本地 vendor）；无 Vite/Webpack
- **Consequences**：交付即静态文件；学习/维护门槛低；后期若界面复杂可平滑迁移到 Vite + 框架

### ADR-003: 下位机协议统一 WebSocket
- **Context**：4G 模组若支持 WS 则全栈协议统一
- **Decision**：服务器只暴露一个 `/ws` 端点；下位机与浏览器都是 WS client
- **Consequences**：服务器代码极简；若某些 4G 模组只支持 TCP，需在 P2 后追加 TCP↔WS 桥（v0.2 功能）

### ADR-004: 不持久化、内存广播
- **Context**：用户明确不存历史数据
- **Decision**：服务器只维护连接列表，不缓存消息
- **Consequences**：重启丢上下文（可接受）；后期若要回放需另设计

---

## Technical Notes / Research

> 本任务定位为"工程脚手架 + 极简 MVP"，不做大型 grok 调研，直接基于成熟模式：
> - WS broker 模式 = 经典 chat-room 范式；`ws` 官方文档有完整 broadcast 示例
> - xterm.js 是 VSCode/Hyper 同款，文档示例足
> - 4G 模组接入 WS：常见模组（如 EC600N、Air724UG）支持 AT+WSCONN/WSDATA 类指令，本工程不约束模组型号，只约束 WS 协议
>
> 若后期发现某 4G 模组不支持 WS（多见于低端 Cat.1 模组），再做 TCP↔WS 桥，归为 v0.2。

