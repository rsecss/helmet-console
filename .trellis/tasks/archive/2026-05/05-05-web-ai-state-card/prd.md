# Web AI Assistant Device State Card + WS State Dispatch

## Goal

升级浏览器端 AI 助手交互闭环：(1) 让 AI 在每次决策时拿到设备实时状态；
(2) 控制后在对话气泡内呈现"全状态快照卡片"；(3) 增加用户主动"一键查询
状态"按钮（不调 LLM）；(4) 控制后追发一帧 `state:` snapshot 到 WS，为
未来跨客户端 UI 镜像留种；(5) AI 工具新增 LED 多色（设备已支持）。

后端 `server/`、固件 `APP/` **零改动**——一切发生在 `web/`。

---

## What I Already Know（来自代码勘察，非用户口述）

- **设备实情**（`APP/m100pg_protocol.{c,h}` + `m100pg_bsp.c`）：
  - 已支持下行命令 `led_on / led_off / led_color_white / led_color_red /
    led_color_green / motor_speed_<0..3> / ping / pong`
  - LED 真实状态枚举 4 态：`OFF / WHITE / RED / GREEN`
  - 上行遥测帧 `temp=…,hum=…,…,led=white,motor=2\n` 已包含 led/motor 镜像
  - `bsp_on_unknown` 仅 `printf` 到调试串口 USART1，未知帧无害
- **当前 web 实情**：
  - `web/js/control-panel.js` LED 模型仅 on/off 二态；电机 `{on: bool,
    gear: 1..3}`
  - `web/js/ai-panel.js` DeepSeek 流式 + tool_calls；history closure
    持有；tool 字典只有 `led_on/off/motor_speed`
  - `web/js/main.js#sendCommand` 是 WS 出站统一入口；`mirrorControlState`
    把命令镜像回控件 UI
  - `onFrame` 仅 `terminal.writeText`，**未消费**遥测/state 字段去更新
    UI（已知真空地带，本次不补）
- **后端约束**（`spec/backend/quality-guidelines.md`）：WS 字节级透传，
  禁 JSON 信封、禁存储、禁业务逻辑——所以"AI prompt 注入"只能在前端
  `ai-panel.js` 组装请求体那一层完成，不可能放到 Node 中继里
- **冲突任务**：`firmware-ws-proto`（planning 中）的 PRD 比 `APP/` 实情
  保守（无 led_color_*）。本任务**不引用**那个 PRD；所有 LED 多色能力
  都按 `APP/m100pg_protocol.c` 实情来对齐

---

## Decisions（D1–D17，brainstorm 已确认）

### 范围与设备
- **D1** 范围：仅"步骤六"——内置提示词 + 卡片 + 一键查询 + WS 下发状态
- **D2** 设备清单：LED + 电机；不新增风扇/窗帘
- **D3** LED 多色：**仅 AI 端**新增能力。AI tools 加 `led_color({color: white|red|green})`；web 控件区按钮"开启/关闭"**不动**

### 卡片与查询
- **D4** AI 触发任意控制 tool 后，在该 AI 气泡末尾追加"设备全状态快照卡片"（含 LED 4 态文案 + 电机 on/off + 档位）；闲聊气泡内不出现
- **D5** "一键查询状态"按钮放在 AI 卡片顶栏（`#aiConfigBar` 内），chip 样式；点击 → **不调 API**，从 `controlPanel.snapshot()` 取状态，渲染为独立 `system` 气泡含同款快照卡

### AI 上下文
- **D6** 注入方式：每次 fetch 时 `messages` 构造为
  `[system主提示, ...history, {role:'system', content:'[当前设备状态] LED=红光; 电机=运行,2档'}, {role:'user', content:用户输入}]`——**独立 system 消息**位于 history 与 user 之间，不拼进主 prompt（保留 prompt-caching 友好）
- **D7** 提示词优化 4 处：
  1. 加一句"你会在每次对话中收到 `[当前设备状态]` 系统消息"
  2. LED 描述改为"四态：关 / 白光 / 红光 / 绿光"
  3. 加 `led_color` tool 说明
  4. 加一句"若用户请求与当前状态一致（如 LED 已开却又说开灯），用一句话告知，**不要**重复调工具"

### WS 状态字符串
- **D8** 触发点：`main.js#sendCommand(command)` 内，每次 `client.send` 成功后**追发**一帧
- **D9** 帧格式：`state:led=<off|white|red|green>,motor=<0..3>\n`（与遥测 KV 同族，`state:` 前缀作判别）
- **D10** terminal 回显：snapshot 帧也用 `[↓]` 前缀——价值 B（log 可读性）
- **D11** 接收侧镜像：**本次不实现**。`main.js#onFrame` 加 `// TODO:` 注释占位

### 架构边界
- **D12** 改动范围：仅 `web/js/` + `web/index.html` + `web/css/style.css`；`server/`、`APP/`、`firmware/` 零改动；调试串口偶见 `[4G] unknown: state:...` 是预期、无害
- **D13** controlPanel 重构：LED 状态 4 态字符串 `'off'|'white'|'red'|'green'`；电机模型不变；新增 `controlPanel.snapshot()` 返回 `{led, motorOn, motorGear}`；`setLedState` 签名改为接受 4 态字符串
- **D14** LED 命令语义对齐：手动点"开启" → 发 `led_on` + UI `setLedState('white')`（与设备 `led_on→WHITE` 对齐）；AI 用 `led_color_*` → UI `setLedState(<color>)`

### 边界处理
- **D15** WS 未连接时点"📋 查询状态"：照常显示快照（用本地 last-known），卡片底加一行 `⚠ 设备未连接，可能与实际不符`；`sendCommand` 发不出 → snapshot 帧也不发（`client.send` 返回 false 短路）
- **D16** API Key 未配置：一键查询照常可用（不涉及 LLM）
- **D17** `state:` 帧不进 AI `history`；一键查询的 system 气泡也不进 `history`（避免污染对话上下文）

---

## Requirements

1. **AI tool 字典扩展**：`ai-panel.js` `TOOLS` 数组新增 `led_color`，
   parameters `{color: 'white' | 'red' | 'green'}`；`translateTool` 增
   `led_color` → `led_color_<color>` 的命令翻译分支
2. **SYSTEM_PROMPT 改写**：按 D7 四处改动；LED 描述为 4 态；添加状态注入
   声明
3. **设备状态注入**：`callDeepSeek` 在构造 `messages` 时插入独立 state
   system 消息，内容由 `formatStateMessage(snapshot)` 生成（中文）
4. **快照卡片 DOM**：在 AI 气泡内部新增 `.ai-bubble-state-card` 元素，
   含 LED 状态行 + 电机状态行；样式与现有 `.ai-bubble-tool` 协调
5. **快照卡片注入逻辑**：`callDeepSeek` 中，当 `finishReason ===
   'tool_calls' && accumulatedTools.length > 0` 时，**所有 tool 处理
   完毕之后**，追加一张快照卡（仅 1 张，不论调了几个 tool）
6. **一键查询按钮**：`index.html` 在 `#aiConfigBar` 内增 `📋 查询状态`
   chip；`ai-panel.js` 暴露 `triggerStatusQuery()` 函数（取 snapshot →
   渲染 system 气泡含快照卡）
7. **WS snapshot 帧**：`main.js#sendCommand` 在 `client.send(command)`
   成功后立即 `client.send('state:led=...,motor=...\n')`；同时
   `terminal.writeText` 用 `TX_PREFIX` 回显
8. **controlPanel 4 态扩展**：
   - `setLedState(state: 'off'|'white'|'red'|'green')` 新签名
   - 状态文案映射：`{off:'已关闭', white:'白光', red:'红光', green:'绿光'}`
   - `[data-state]` 属性扩展为 4 个值（CSS 提供色标）
   - 新增 `snapshot()` → `{led, motorOn, motorGear}`
9. **`mirrorControlState` 兼容**：识别 `led_color_<white|red|green>` 前缀，
   调 `setLedState(<color>)`；识别 `led_on` → `setLedState('white')`；
   `led_off` → `setLedState('off')`
10. **接收侧镜像 TODO 占位**：`main.js#onFrame` 内加注释，标记未来在此
    解析 `state:` 帧的钩子位置

---

## Acceptance Criteria

### 功能验收
- [ ] AI 调 `led_color_red` → terminal 出现两行：`[↓]led_color_red\n` 紧
      跟 `[↓]state:led=red,motor=<gear>\n`；该 AI 气泡末尾出现快照卡：
      "LED: 红光 / 电机: 已停止"
- [ ] 用户问"今天天气怎么样" → AI 文本回复，气泡内**无**快照卡，**无**
      snapshot 帧发出
- [ ] 点 `📋 查询状态` → DevTools network **零**请求；AI 区追加一条
      `system` 气泡含快照卡（同款 DOM）
- [ ] DevTools network 看 chat/completions 请求 → `messages` 数组里有
      独立 `{role:'system', content:'[当前设备状态]…'}`，位于 history
      之后、user 之前
- [ ] WS 断开时点 `📋 查询状态` → 卡片底显示 `⚠ 设备未连接，可能与实际不符`
- [ ] 手动点 LED "开启"按钮 → terminal 出 `[↓]led_on\n` + `[↓]state:led=white,motor=<gear>\n`；UI 状态值显示"白光"
- [ ] AI 在 LED 已是白光时被要求"开灯" → 模型一句话告知"已是白光"，
      **不**调工具（D7.4 生效；通过 network tab 确认无 tool_calls）
- [ ] AI 询问"现在 LED 是开还是关" → 模型回答与 `controlPanel.snapshot()`
      一致（证明 D6 状态注入生效）
- [ ] AI 一轮调 2 个 tool（如`led_off`+`motor_speed_0`） → 仅追加 1 张
      快照卡，且其内容反映两次 tool 应用之后的最终态

### 工程验收
- [ ] `npm run lint` 通过
- [ ] `npm run format:check` 通过
- [ ] `npm test`（lint + smoke）通过
- [ ] 设备 USART1 串口出现 `[4G] unknown: state:led=...,motor=...` 是
      预期行为（属于设备日志、不属于错误）
- [ ] `web/js/control-panel.js` 不引入 ws-client（保持模块边界）
- [ ] `web/js/ai-panel.js` 不直接调 `client.send`（仍走 `onTool` 注入）
- [ ] `web/js/main.js` 是 snapshot 帧的**唯一**发出点（统一出站入口）

### 自动化测试（chrome-devtools MCP）
- [ ] 浏览器自动化覆盖：3 条核心路径
  1. AI 控制路径：mock LLM 响应 → 验证快照卡渲染 + snapshot 帧发出
  2. 一键查询路径：点击按钮 → 验证零网络请求 + system 气泡渲染
  3. 手动控制路径：点击 LED 开启 → 验证 led_on + state: 两帧 + UI 文案
- [ ] 控制台无未捕获错误（`list_console_messages` 验证）

---

## Definition of Done

- 所有 Acceptance Criteria checkbox 打勾
- 代码遵循 `karpathy-guidelines`（最小改动、无过度抽象、显式假设、可验
  证成功标准）
- `web/` 现有的模块边界不被破坏：control-panel 仍是状态唯一拥有者；
  config-panel 仍是唯一 localStorage 写者；terminal 仍是 display-only
- chrome-devtools MCP 自动化测试已运行并截图（结果留 journal）
- 在 `journal-1.md` 记录会话总结
- 用户测试通过，由用户手动 commit

---

## Out of Scope（显式排除）

- ❌ 接收侧 `state:` 帧解析 + 跨客户端 UI 镜像（仅留 TODO）
- ❌ web 控件区新增颜色按钮（手动控件继续仅 on/off）
- ❌ 新增风扇/窗帘等设备
- ❌ 修改 `server/` 中继代码
- ❌ 修改 `APP/` 固件代码
- ❌ 修改 `firmware-ws-proto` PRD（该任务保留独立演化）
- ❌ AI 端 prompt caching 接入（虽然 D6 设计为友好，但本次不开）
- ❌ 多 tool 批次的"批次结束"判定（一律每个 tool 后处理，但快照卡只追
      加 1 张——通过 tools 全循环结束后再 append 实现）
- ❌ snapshot 帧的去重 / 节流（每个 sendCommand 必发，简单优先）

---

## Technical Approach

### 模块改动概览

| 文件 | 改动类型 | 主要内容 |
|---|---|---|
| `web/index.html` | 新增/微调 | `#aiConfigBar` 内加 `📋 查询状态` chip 按钮；LED 状态文案 placeholder 不再硬编码"已关闭" |
| `web/js/control-panel.js` | 重构 | LED 4 态；新 `setLedState(stateStr)`；新 `snapshot()`；保留旧的 `setMotorSpeed` 不变 |
| `web/js/ai-panel.js` | 扩展 | tools 加 `led_color`；prompt 改写；callDeepSeek 注入 state msg；新 `appendStateCard(bubble, snapshot)`；新 `triggerStatusQuery()` 函数；新 `formatStateMessage(snapshot)` |
| `web/js/main.js` | 扩展 | sendCommand 后追发 snapshot；mirrorControlState 兼容 led_color；onFrame 加 TODO 注释；将 `controlPanel.snapshot` 与 `triggerStatusQuery` 接线 |
| `web/css/style.css` | 新增 | `.ai-bubble-state-card` 样式；查询按钮样式；LED 4 色 data-state 映射 |

### 关键代码点

#### controlPanel 状态模型
```js
// 新签名
function setLedState(state) {
  // state ∈ 'off' | 'white' | 'red' | 'green'
  ledStatus.dataset.state = state;
  ledStatusValue.textContent = LED_LABEL[state]; // {off:'已关闭', ...}
  const isOn = state !== 'off';
  ledOnButton.setAttribute('aria-pressed', isOn);
  ledOffButton.setAttribute('aria-pressed', !isOn);
}

function snapshot() {
  return { led: currentLed, motorOn, motorGear };
}
```

#### main.js snapshot 帧出站
```js
function emitStateSnapshot() {
  const { led, motorOn, motorGear } = controlPanel.snapshot();
  const motor = motorOn ? motorGear : 0;
  const frame = `state:led=${led},motor=${motor}\n`;
  if (client.send(frame)) {
    terminal.writeText(`${TX_PREFIX}${frame}`);
  }
  // 注意：snapshot 失败不报错——它是 best-effort
}

function sendCommand(command) {
  const ok = client.send(ensureTrailingNewline(command));
  if (!ok) return;
  terminal.writeText(`${TX_PREFIX}${command}\n`);
  emitStateSnapshot(); // ← 追发
}
```

#### ai-panel.js 状态注入
```js
function formatStateMessage(snapshot) {
  const ledLabel = LED_LABEL[snapshot.led]; // 已关闭/白光/红光/绿光
  const motorLabel = snapshot.motorOn
    ? `运行,${snapshot.motorGear}档`
    : '已停止';
  return `[当前设备状态] LED=${ledLabel}; 电机=${motorLabel}`;
}

// callDeepSeek 内
const stateMsg = { role: 'system', content: formatStateMessage(getSnapshot()) };
const messages = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...history,
  stateMsg,
  { role: 'user', content: userText },  // 注：先 push history.user 再切
];
```

注：history 内的 user 消息已在调用前 push 进 history（现有逻辑），所以
实际构造时 user 是 history 最后一条，stateMsg 插在 history 之前。需要
微调顺序使 stateMsg 紧贴 user 之前。

#### 快照卡注入
```js
// 在 callDeepSeek 末尾，所有 tool 处理完后
if (finishReason === 'tool_calls' && accumulatedTools.length) {
  for (const tc of accumulatedTools) { /* …现有逻辑… */ }
  appendStateCard(aiBubble, getSnapshot()); // ← 新增：1 张总结卡
}
```

#### 一键查询
```js
function triggerStatusQuery() {
  const bubble = appendBubble('system', '');
  appendStateCard(bubble, getSnapshot(), { manual: true, wsConnected: isWsConnected() });
}
```

---

## Decision (ADR-lite)

**Context**：用户希望"后端把上一次返回数据作为内置提示词"——但项目
后端是无状态字节中继，物理上做不到。AI 调用是浏览器 → DeepSeek 直连。

**Decision**：将"后端注入"重新解释为"前端组装请求体那一层注入"。在
`ai-panel.js` 的 `callDeepSeek` 中插入独立 system 消息（非拼接进主
prompt）。设备状态来源是 `controlPanel.snapshot()`——与 controlPanel
作为状态唯一拥有者的现有模式一致。

**Consequences**：
- ✅ 不破坏 backend 规约（无 JSON 信封、无中继业务逻辑）
- ✅ 主 system prompt 保持常量化，未来开 prompt caching 不被状态变化击穿
- ✅ 状态读取统一走 `snapshot()`，AI 注入 + 一键查询 + snapshot 帧三处复用
- ⚠️ 状态准确性 ≤ controlPanel intent-mirror 的准确性。若设备实际状态
  与 intent 偏离（如硬件故障未应用命令），UI 与 AI 都会被误导——这是
  既存问题（与本任务无关），未来"接收侧解析遥测帧"才能修复
- ⚠️ snapshot 帧让设备调试串口出现 `[4G] unknown: state:...` 行——可接
  受，已与固件实情验证

---

## Technical Notes

### 已勘察文件
- `web/js/ai-panel.js`（406 行）：DeepSeek 流式 + tool_calls 已实现；
  `history` closure 持有；`appendBubble/appendToolLine` DOM 注入路径
- `web/js/control-panel.js`（123 行）：LED 二态 + 电机两轴；
  `setLedState(bool)` / `setMotorSpeed(value)`
- `web/js/main.js`（203 行）：`sendCommand` 是 WS 出站统一入口；
  `mirrorControlState` 已存在 led_on/off/motor_speed_ 三分支；onFrame
  仅 echo terminal
- `web/index.html`（313 行）：`#aiConfigBar` 内是 chip 容器；
  `#panelView` 含 `.control-card` × 2 + `.data-card`
- `APP/m100pg_protocol.{c,h}`：设备命令字典 + 4 态 LED + 遥测格式
- `APP/m100pg_bsp.c:34-39`：`bsp_on_unknown` 仅调试 printf
- `.trellis/spec/backend/quality-guidelines.md`：禁 JSON 信封 + 字节透传
- `.trellis/spec/frontend/quality-guidelines.md`：模块边界 + 三态映射 + localStorage 唯一写者

### 实施约束（karpathy-guidelines）
- **最小改动**：不重写 `ai-panel.js` 整体；扩展 `TOOLS` 数组、`SYSTEM_PROMPT`
  字符串、`callDeepSeek` 局部插入，避免 churn
- **显式假设**：`led_on` 在设备 = `WHITE` 已通过 `m100pg_protocol.c:62
  dispatch_led(p, HELMET_LED_WHITE)` 验证
- **可验证成功标准**：每条 Acceptance Criteria 都对应 chrome-devtools
  自动化场景或 DevTools network/console 检查项
- **不抽象未使用代码**：`emitStateSnapshot` 不抽 hook、不参数化触发条
  件——只服务于 `sendCommand` 的统一调用
- **删除产生的孤儿，但不顺手清无关代码**：本次只增不删现有功能（`led_on/off`
  路径、 `setMotorSpeed` 等保留）

### 测试策略
- **手动测试**：用户在 panel + AI 两视图分别触发各路径
- **自动化**：chrome-devtools MCP（`take_snapshot` / `evaluate_script` /
  `list_network_requests` / `list_console_messages`）覆盖 3 条核心路径
- **lint/format**：每次改完跑 `npm run lint` + `npm run format:check`

### 引用
- `docs/architecture.md` §6.3 心跳协议
- `docs/interface.md` 命令字典
- `.trellis/spec/frontend/state-management.md` 状态层次
