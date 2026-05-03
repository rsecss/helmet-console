# Web AI 对话面板 (DeepSeek V4)

> Status: Approved (post-brainstorm 2026-05-03)
> Type: Frontend (web/) — backend 零改动

## 1. Goal

在 helmet console 的 `web/` 中实装 AI 助手视图，让用户能用**自然语言**（如「把灯打开」「电机调到 3 档」）通过 DeepSeek V4 API 控制头盔 LED + 电机，AI 输出经 OpenAI 兼容的 `tool_calls` 翻译为现有的 `cmd` WebSocket frame，沿用已有的 `sendControl()` 通道下发到设备。

## 2. Background

- `web/index.html:19` 已预留 `<button data-view="ai">AI助手</button>` tab
- `web/js/main.js:108-110` 当前是 `console.info('[placeholder] AI助手 view not implemented yet')` 占位
- 现有 `control-panel.js` 通过 `main.js#sendControl(payload)` → `ws-client.send()` 下发 cmd frame
- 后端 `server/` 是 forward-only relay（spec 锁死，禁止业务路由）
- 本任务把 placeholder 替换为真实可用的 AI 对话面板

## 3. Scope

### 范围内（MVP）
- DeepSeek V4 对话（流式 SSE，OpenAI 兼容）
- AI 通过 `tool_calls` 触发 LED 开关 / 电机调速三个 tool
- AI 面板内嵌 API key + base URL + 模型配置区
- key / endpoint / model 持久化到 localStorage（参照 `console.ws.*` 模式）
- AI tool_call 执行后 control-card UI 状态同步更新

### 范围外（推迟到下一阶段，记为 Future / Phase C）
- AI 主动订阅设备 `status` / `data` frame（双向 agent）
- AI 多轮 tool 反馈回灌（tool result → AI）
- 危险动作确认弹窗（DANGEROUS_TOOLS 现为空）
- 自由文本 cmd（让 AI 直接发 AT 指令）
- 对话 history 跨刷新持久化
- system prompt UI 编辑
- thinking / reasoning_effort 暴露给用户

## 4. Architecture

### 4.1 数据流

```
[ DeepSeek API ]                [ ws-relay (server/) ]                [ MCU ]
       ▲                                ▲                              │
       │ HTTPS fetch + SSE              │ WS cmd frame                  │
       │                                │                              │
[ web/js/ai-panel.js ]──tool_call──>[ main.js#sendControl ]───>[ ws-client ]
       ▲
       │ user message
       │
   AI 视图气泡区
```

浏览器同时持两条连接：HTTPS 到 DeepSeek，WS 到 ws-relay。AI 输出的 `tool_calls` **就地翻译**为 cmd frame，走现有 sendControl 通道。**不新增任何后端业务路由**，符合 backend forward-only spec。

### 4.2 模块边界（与现有 frontend spec 同构）

| 模块 | 职责 | 不可碰 |
|---|---|---|
| `ai-panel.js`（新） | AI 配置条 + 对话气泡 + DeepSeek fetch + SSE 解析 + tool_call 派发 | `ws-client` 直引 / `data-state` / `data-view` |
| `view-switcher.js`（新） | view-toggle 按钮 + `.app-shell[data-view]` 单一写入者 | 业务逻辑 |
| `main.js` | 注入 `onTool(payload) → sendControl(payload)` 回调 + 注入 `onLedState`/`onMotorSpeed` 让 AI 行动同步到 control-card | 不直接调 ai-panel 内部 |
| `config-panel.js` | 不变 | — |
| `control-panel.js` | 暴露已有 `setLedState` / `setMotorSpeed` 给 main.js 用 | — |
| `ws-client.js` | 不变 | — |
| `terminal.js` | 不变 | — |

### 4.3 AI view 下分区可见性（由 `[data-view]` CSS 驱动）

| 区域 | terminal view | ai view |
|---|---|---|
| topbar | 显示 | 显示 |
| connection-bar | 显示 | **显示**（设备 ws 状态全局可见） |
| terminal-card | 显示 | **隐藏** |
| ai-card（新） | **隐藏** | **显示** |
| command-bar | 显示 | **隐藏** |
| control-cards | 显示 | **显示**（应急控制 + AI 行动可见化） |

## 5. Decisions（grill 输出）

| ID | 决策 | 实施位置 |
|---|---|---|
| D1 | DeepSeek V4 SKU `deepseek-v4-flash` / `deepseek-v4-pro`，可 UI 切换；默认 `deepseek-v4-flash` | `console.ai.model` |
| D2 | 浏览器直调 DeepSeek，API key 存 localStorage，后端零改动 | `ai-panel.js` fetch |
| D3 | scope = (b) 单向命令翻译器：tools = `led_on` / `led_off` / `motor_speed`，立即执行，不回灌 | tool list 常量 |
| D4 | UI = (a) 替换主视图，沿用 `data-view="ai"` tab 语义 | `view-switcher.js` |
| D5 | 配置入口：AI 面板顶端嵌一条配置条（mask key、模型下拉、修改按钮），与 connection-bar 同构 | `ai-panel.js` |
| D6 | localStorage 命名空间 `console.ai.*`，单一 owner = `ai-panel.js#writeAiConfig()` | localStorage |
| D7 | 流式 SSE，`fetch` + `ReadableStream` 自实现解析（无 SDK，无 vendor 库） | `ai-panel.js` |
| D8 | tool 调用 = OpenAI tools 格式；流终止 + `finish_reason:'tool_calls'` 后整体执行；不回灌多轮；history 仅留 `content` 字段 | `ai-panel.js` |
| D9 | 错误 = 红色 system 气泡（401/429/5xx/网络/ws 未连接），不打断对话，不重试 | `ai-panel.js` |
| D10 | system prompt 中等长度（含设备语义），硬编码常量；允许并行 tool_call；不限答题范围；MVP 无危险护栏（`DANGEROUS_TOOLS=[]`） | `ai-panel.js` 顶部 |
| D11 | history 刷新清空；`console.ai.*` 配置持久化（key / baseUrl / model） | localStorage |
| D12 | thinking 固定 `disabled` 硬编码在 request body（命令翻译不需要推理） | request body |

## 6. Tool Schema（与 control-panel cmd payload 一一对应）

```jsonc
[
  {
    "type": "function",
    "function": {
      "name": "led_on",
      "description": "打开头盔 LED 灯阵列",
      "parameters": { "type": "object", "properties": {} }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "led_off",
      "description": "关闭头盔 LED 灯阵列",
      "parameters": { "type": "object", "properties": {} }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "motor_speed",
      "description": "设置头盔驱动电机速度档位（0=停止，5=最高速）",
      "parameters": {
        "type": "object",
        "properties": {
          "value": { "type": "integer", "minimum": 0, "maximum": 5 }
        },
        "required": ["value"]
      }
    }
  }
]
```

工具名 → cmd payload 的翻译表（在 `ai-panel.js` 实现）：

| tool name | arguments | 翻译成 cmd payload |
|---|---|---|
| `led_on` | `{}` | `{ action: 'led_on' }` |
| `led_off` | `{}` | `{ action: 'led_off' }` |
| `motor_speed` | `{ value: n }` | `{ action: 'motor_speed', value: n }` |

⚠️ 当前 control-panel.js 已有的 cmd payload 形态是这三种，`ai-panel.js` 必须**完全复用**，不能凭空发明新 action。未来加新 action 时，**两边一起改**（spec 在 frontend/quality-guidelines.md §3 已经记录）。

## 7. localStorage Schema

```
console.ai.apiKey      string   sk-...                              （DeepSeek API key）
console.ai.baseUrl     string   https://api.deepseek.com            （API endpoint，可改私有部署/代理）
console.ai.model       string   deepseek-v4-flash | deepseek-v4-pro （默认 flash）
```

**唯一写入者**：`ai-panel.js#writeAiConfig()`。所有读取可在任意位置进行（参照 `console.ws.*` 模式）。

读取顺序：`writeAiConfig` 首次写入用默认值（baseUrl=`https://api.deepseek.com`、model=`deepseek-v4-flash`、apiKey=空）；后续以 localStorage 为准。

`thinking` 不进 localStorage，request body 固定 `{ type: 'disabled' }` 硬编码。

## 8. System Prompt（MVP 硬编码）

```
你是「Helmet Console」中的头盔控制助手。

设备说明：
- LED：头盔顶部照明阵列，仅有「开 / 关」两态。
- 电机：驱动电机，档位 0-5，0 表示停止，5 表示最高速。

工作方式：
- 用简体中文回答用户。
- 当用户意图是控制设备时，调用对应工具（tool）执行；先用一句简短自然语言告知用户你将做什么，再调工具。
- 用户可能问与硬件无关的问题，正常回答即可。
- 多步动作允许一次发出多个工具调用。
```

## 9. UI Specification

### 9.1 ai-panel 配置条（顶端）

```
┌─ AI 配置条 ─────────────────────────────────────┐
│ 🔑 sk-***1234   [deepseek-v4-flash ▾]   [修改] │
└─────────────────────────────────────────────────┘
```

- key 显示 mask `sk-***xxxx`（取最后 4 位）
- model 下拉：`deepseek-v4-flash` / `deepseek-v4-pro`
- 修改按钮 → 弹出（或就地展开）输入区：
  - `<input type="password">` 输入 key
  - `<input type="url">` 输入 baseUrl（默认 `https://api.deepseek.com`）
  - `<button>` 保存

### 9.2 ai-panel 未配置态

key 为空时整面板进入"空态"，居中显示提示 + 输入框 + 保存按钮：

```
🤖 配置 DeepSeek API Key 启用对话
[ sk-...                          ]
[ https://api.deepseek.com        ]
        [ 保 存 ]
```

输入框 / 发送按钮 disabled。保存后切回正常对话态。

### 9.3 对话气泡区

```
user: 把灯打开
ai:   好的，已为你打开 LED
      ↳ led_on  ✓
ai:   现在把电机调到 3 档
      ↳ motor_speed(value=3)  ✓
[输入消息...                       ] [发送]
```

- 三种气泡：user（右） / ai（左） / system（居中红色，错误用）
- ai 气泡内 tool_call 行使用缩进 + `↳` 前缀 + 状态徽章（`✓` 成功 / `⚠ <reason>` 失败）
- ai 流式输出时 token 增量追加；tool_call 行在 `finish_reason` 后追加

### 9.4 错误显示

| 错误条件 | 系统气泡文案 |
|---|---|
| HTTP 401 | `API Key 无效，请检查配置` |
| HTTP 429 | `请求过于频繁，请稍后重试` |
| HTTP 5xx | `DeepSeek 服务异常 (HTTP <status>)` |
| Network | `网络连接失败，请检查网络` |
| ws 未连接时 tool_call | tool_call 行徽章 `⚠ 设备未连接`（不是 system 气泡） |
| AI 输出未注册 tool name | tool_call 行徽章 `⚠ 未知工具 <name>` |
| arguments JSON parse 失败 | tool_call 行徽章 `⚠ 参数解析失败` |

## 10. Acceptance Criteria

### 功能验收
- [ ] `web/index.html` 切到 AI tab 后看到 ai-panel；切回终端正常显示原 terminal-card
- [ ] 未填 key 时显示空态卡片；填入 key 后显示对话区
- [ ] 输入"把灯打开"，AI 通过 tool_call 触发 `sendControl({action:'led_on'})`，ws frame 实际发出
- [ ] LED 控制卡的状态显示同步更新为「已开启」（`controlPanel.setLedState(true)` 被调用）
- [ ] 输入"电机调到 3 档"，触发 `sendControl({action:'motor_speed', value:3})`，控制卡滑块跟随到 3
- [ ] 流式输出可见 token-by-token 追加
- [ ] 401 错误显示红色系统气泡 `API Key 无效，请检查配置`
- [ ] 设备 ws 未连接时 AI tool_call 行内显示 `⚠ 设备未连接`
- [ ] 刷新页面后 key / baseUrl / model 仍在；对话历史清空

### 模块边界 / spec 验收
- [ ] `index.html` 仍只是结构（无 inline `<script>` body 或 `<style>`）
- [ ] `ai-panel.js` 不直接 import `ws-client.js`，仅通过 main.js 注入回调
- [ ] `view-switcher.js` 是 `.app-shell[data-view]` 的**唯一写入者**
- [ ] `console.ai.*` localStorage 的**唯一写入者**是 `ai-panel.js#writeAiConfig()`
- [ ] 没有引入新 vendor 库（DeepSeek SDK / OpenAI SDK 都不引）
- [ ] 没有从 CDN 加载任何资源
- [ ] reserved-placeholder 的 `[placeholder] AI助手 view not implemented yet` 这一行被移除
- [ ] `npm run lint` / `npm run format:check` / `npm test` 全部通过

### 后端验收（应该零改动）
- [ ] `server/src/` 无任何改动
- [ ] `server/scripts/smoke.js` 无需修改
- [ ] backend `quality-guidelines.md` 无需更新

## 11. Out of Scope（明确划线）

- 设备 status frame 注入 AI 上下文
- AI 多轮 tool result 反馈（OpenAI 标准的 3-轮 tool flow）
- 对话 history 持久化 / 导出 / 分享
- 危险动作确认（无危险 tool）
- thinking / reasoning_effort 用户可调
- system prompt 用户可编辑
- 模型微调 / 自定义 endpoint UI 之外的 base_url 处理
- 多窗口同步（多个 console tab 之间共享对话）
- AI 翻译失败重试

## 12. Future (Phase C — NOT preserved in code)

下面是 Phase C 的方向，**当前任务不预留任何接口/常量/字段**（按 Karpathy §2 simplicity，未使用的预留 = speculative）。Phase C 真做时再加，加的成本和现在预留是一样的：

- 入站 frame 注入 AI 上下文（届时在 main.js 增加 onFrame → ai-panel 的回调即可）
- 危险动作确认（届时在 ai-panel 加 DANGEROUS_TOOLS 数组 + confirm 弹窗即可）
- thinking 模式开关（届时把 thinking 提到 localStorage + 加 UI toggle 即可）
- 多轮 tool result 回灌（届时让执行函数返回值并塞回 messages 即可）

## 13. Spec 更新需求（任务完成后同步）

新功能涉及前端模块边界扩展，**任务完成时**需要更新：

- `.trellis/spec/frontend/quality-guidelines.md` §"Frontend-Specific Hard Constraints" 加入 `ai-panel.js` 和 `view-switcher.js` 的模块描述
- §"Module boundary" 表格新增两行
- §"LocalStorage keys" 表格新增 `console.ai.*` 3 行（apiKey / baseUrl / model）
- §"Reserved-Interface Placeholder Handlers" §3 移除 `AI 助手` 这一行（已落地）
- 新增 §"AI Panel + DeepSeek Integration" Scenario，记录 tool schema 翻译表、流式协议、错误矩阵
- `web/index.html` 的 `<button data-view="ai">` 不再是 placeholder，placeholder 测试项要更新
