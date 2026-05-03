# WS String Protocol

## Goal

把 WebSocket 帧从 JSON 信封 (`{from,type,payload,ts}`) 改成**单行
字符串协议**（snake_case + 下划线拼接参数 + `\n` 终止），让单片机
（MCU）端用 `strcmp` / `strncmp` 即可分发，**无需 JSON 解析器**。

服务器降级为**纯字节流转发器**（broadcaster），不再校验任何字段。

## Background

当前实现：

- `server/src/ws-relay.js` — 解析 JSON、校验 `from/type/payload`、
  广播；`type==='ping'` 回 `pong`。
- `web/js/ws-client.js` — `send(frame)` 内部 `JSON.stringify`；接收
  `JSON.parse(event.data)`。
- `web/js/main.js#sendControl` — 包成 `{from:'web',type:'cmd',payload:{...}}`
  走 ws-client。
- `web/js/terminal.js#writeFrame` — 按 `frame.type`/`frame.payload` 渲染。

对单片机（资源受限 MCU + 4G 模组）来说，引入 cJSON 等 JSON 解析器
代价大；用户要求"协议简单一点，直接字符串"。

## Decisions (锁死)

| 决策 | 选择 |
|---|---|
| 协议格式 | snake_case 动词；带参数用 `_` 拼接：`led_on` / `led_off` / `motor_speed_<N>` / `ping` / `pong` |
| 行尾 | `\n`（LF，单字节）；接收侧应当容忍 `\r\n` |
| 方向 | 双向都用字符串；浏览器、MCU、server 三方对等 |
| Server 角色 | **纯透传** — 收到 text frame 原样广播给除发送方外所有 client；不解析、不校验、不分支业务字符串 |
| Server 唯一例外 | 仅当 frame 等于 `ping\n`（去尾换行后等于 `ping`）时回 `pong\n`（不广播）；这是为了让单 client 也能维持心跳 |
| 错误处理 | 收到 binary frame → 关闭该 client；不再有 `BAD_FRAME` 信封；非法 UTF-8 同样关闭 |
| Frame 边界 | 每个 WebSocket text frame **就是**一条命令；服务器既不拼接也不切分；客户端在发送前确保单帧单命令 |
| 终端显示 | xterm 直接 `term.write(text)`，原样显示；无需识别字段 |
| AI 翻译 | DeepSeek tool_calls → 直接生成字符串命令调 `onTool('led_on\n')` |
| 旧字段 (`from/type/payload/ts`) | 全部废弃 |
| 心跳节奏 | 维持现状：客户端 30s 发 `ping\n`，45s 无任何帧则 close 重连 |

### 命令字典 v1

| 命令 | 方向 | 含义 |
|---|---|---|
| `led_on\n` | web → device | 开灯 |
| `led_off\n` | web → device | 关灯 |
| `motor_speed_<0..5>\n` | web → device | 设速度档位 |
| `ping\n` / `pong\n` | client ↔ server | 心跳 |
| 其他文本 | device → web 任意 | 上行数据，原样转发 |

> 设备上行用什么字符串由设备端自由决定；server 不约束。建议设备
> 用小写 snake_case，便于未来反向 echo / 自动化。

### Server 透传规则（最终行为）

| 输入 | Server 行为 |
| --- | --- |
| Text frame `ping\n`（或裸 `ping`） | 回发 `pong\n` 给发送方，**不**广播 |
| Text frame 任意其他内容 | 原样广播给除发送方外所有 client |
| Binary frame | 关闭该 client（code 1003 unsupported data） |
| 客户端断开 | 移除引用，不广播 |

> 服务器**不**为每帧补 `ts`、不**复**制内容、不**改**大小写。

## Requirements

### Backend (`server/`)

- [ ] `ws-relay.js`：`createWsRelay({ wsPath, maxClients, logger })`
      签名不变；内部移除 `parseFrame` / `validateFrame` / `normalizeFrame` /
      `sendError` / `sendFrame`，改为：
  - 收到 binary frame：`ws.close(1003, 'binary not supported')` 并 return
  - 收到 text frame：UTF-8 decode 后**不做内容校验**
  - 若 trim 后等于 `'ping'`：原样回发 `'pong\n'` 给发送方
  - 否则原样广播 `data.toString('utf8')` 给除 sender 外所有 OPEN client；server 不附加 `\n`，由 sender 负责
- [ ] `index.js` 不需要改（composition only）。
- [ ] `static.js` 不需要改（HTTP / `/healthz` 不变）。
- [ ] `config.js` 不需要改。
- [ ] `server/scripts/smoke.js`：
  - `/healthz` 形状断言不变
  - 广播测试改为 sender 发送 `'led_on\n'`，receiver 收到 `'led_on\n'`
  - 新增：sender 发 `'ping\n'`，sender 自己（不是 receiver）收到 `'pong\n'`
  - 新增：sender 发 binary frame，预期 socket 收到 close

### Frontend (`web/`)

- [ ] `ws-client.js`：
  - `send(text)`：参数从 `frame` 对象改成 `string`；当 client 已连接时 `socket.send(text)`，未连接 `onLog('[ws] not connected')` 返回 false
  - 接收 handler：直接 `onFrame(event.data)`（去掉 `JSON.parse`）；`event.data` 已经是 string 因为 server 不发 binary
  - 心跳：`send('ping\n')`
  - 维持 30s/45s 节奏与 5 态机
- [ ] `main.js`：
  - `sendControl(text)` 改为透传字符串 `client.send(text)`
  - LED on → `'led_on\n'`，LED off → `'led_off\n'`
  - 电机 → `'motor_speed_' + value + '\n'`
  - `onFrame(text)`：丢弃 `'pong\n'`（含 `'pong'` trim 后），其余 `terminal.writeText(text)`
- [ ] `command-panel.js`：`onSend(command)` 不变；`main.js` 包装时改为 `client.send(command + (command.endsWith('\n') ? '' : '\n'))`
- [ ] `terminal.js`：
  - 新增 `writeText(text)`：直接 `term.write(text)`
  - 移除 `writeFrame`（或保留为空壳并 deprecated）；本 PRD 选择**移除**并由 `writeText` 替代，调用方改 main.js 一处
  - `writeLine` 保留（用于 `[ws] connect ...` 类内部日志）
- [ ] `control-panel.js`：
  - 回调签名改：`onLedOn()` / `onLedOff()` 不再带参；`onMotorSpeed(value:number)` 仍传数字（main.js 负责拼字符串）。**实质上保持不变**，只是上游消费方变了
- [ ] `ai-panel.js`：
  - `translateTool(name, args)` 返回字符串：`'led_on'` / `'led_off'` / `'motor_speed_<N>'`（不带 `\n`，由 main.js sendControl 兜底加）
  - `onTool(textCommand)` 签名相应改：参数为字符串
  - `main.js` 镜像 LED/电机时用前缀匹配解析 `motor_speed_` 后的数字
- [ ] `command-panel.js` 不变，但用户输入命令也走字符串通道——这条天然兼容。

### 文档与 Spec 同步

- [ ] `docs/architecture.md` §3 序列图（cmd / status / AI 三处）、§4 协议章节整段重写、§9 未来扩展点中"协议字段"段更新
- [ ] `docs/interface.md` WebSocket 部分整段重写
- [ ] `.trellis/spec/backend/quality-guidelines.md`：Scenario §2/§3/§4/§5/§6/§7 改成字符串协议；签名表删除 `VALID_TYPES`；validation 矩阵改 binary close
- [ ] `.trellis/spec/backend/index.md` Quality Check 列表对应项目更新
- [ ] `.trellis/spec/backend/error-handling.md`：删 `BAD_FRAME` 表项，新增 binary close 行为；`Pattern 1` 重写
- [ ] `.trellis/spec/backend/logging-guidelines.md`：删 `BAD_FRAME` 提及（如有）
- [ ] `.trellis/spec/frontend/quality-guidelines.md`：Required Patterns 中"Command frame / Control frames"改成字符串；Validation matrix `Incoming invalid JSON` → `Incoming binary frame`；Wrong/Correct 示例改字符串；AI 工具→cmd 表改字符串；Code Review Checklist 对应条目更新
- [ ] `.trellis/spec/frontend/state-management.md`：3-state 节中提到 `frame.type` 处更新
- [ ] `.trellis/spec/frontend/type-safety.md`：删除"WS 边界 JSON.parse"段，改成"接收原始字符串"

> 不需要改：`docs/contributing.md`、`docs/deployment.md`、`docs/design/*`、
> `docs/architecture.md` §1/§2/§5/§6.1/§6.2/§7/§8/§10。

## Acceptance Criteria

- [ ] 浏览器点 LED 开 → DevTools Network 面板看到 ws frame 内容是字符串 `led_on\n`，长度 7 字节；不再有 JSON 大括号
- [ ] 浏览器拖动电机滑块到 3 → ws frame 内容是 `motor_speed_3\n`
- [ ] 终端窗口直接显示设备上行字符串（如设备发 `temp=42\n`，终端显示 `temp=42`）
- [ ] AI 助手发"打开灯"，最终 ws frame 是 `led_on\n`，控件 LED 镜像变为"已开启"
- [ ] `npm test`（lint + smoke）通过
- [ ] `npm run format:check` 通过
- [ ] 服务器 `console.warn` 不再出现 `BAD_FRAME`
- [ ] 多 client 并发：A 发 `led_on\n`，B、C 收到完整 `led_on\n`，A 自己**不**收到
- [ ] Binary frame：手动构造 `ws.send(new Uint8Array([1,2,3]))`，server 关闭该 socket（code 1003）

## Technical Notes

### Edge cases

1. **多命令一帧**：用户在 command-panel 粘贴多行，每行一条命令。
   方案：`command-panel` 不拆分；`main.js` 包装发送时按 `\n` split，
   逐条 `client.send(line + '\n')`。空行跳过。
   - 这样保证服务器不需要处理消息边界。
2. **超长命令**：text frame max payload 当前 1MB（`maxPayload: 1024*1024`），
   远超任何合理 MCU 命令。不改。
3. **设备主动断开**：与现状一致；server 仅移除引用。
4. **设备发非 UTF-8**：`data.toString('utf8')` 在 Node 端会替换非法字节
   为 `�`；不再校验，原样转发。如果未来出问题，可加上"transmit as
   binary if not valid UTF-8"，但目前 KISS。
5. **Server 响应 `ping`**：必须在收到 `ping`（含 `ping\n`、`ping\r\n`、裸 `ping`）时
   回 `pong\n`。判定逻辑：`if (text.replace(/\r?\n$/,'') === 'ping')`。
6. **AI panel 翻译**：保留参数越界、未知工具的 UI 警告，仅替换字符串生成。
7. **设备的 `pong`**：如果设备对自己收到的 `ping`（其他 client 发的）做了
   `pong` 回复，server 会广播这个 `pong`。这是设备实现细节，server 不负责。
   推荐设备**不要**响应他人的 ping。

### Migration

破坏性变更，**没有兼容层**。所有 client 必须同时升级。
当前系统只有 `web/` + 计划中的 MCU；旧浏览器 tab 重连失败时刷新即可。

### 不在范围

- 不实现 ACK / 重发
- 不引入帧序号
- 不区分命令 / 数据 / 状态语义（一切都是字符串）
- 不实现校验和 / CRC
- 不实现命令注册表（动态扩展时直接加新动词）

## Out of Scope

- MCU 端固件代码（不在本仓库）
- frpc 配置 / 部署脚本 (`deploy/`)
- 设备模拟器 / 自动化测试增强（后续可加 `tools/device-sim.js`，本任务不做）
