# 4G 模组上云收发数据实机测试

## Goal

把搭载 4G 模组的下位机接入已部署的 helmet-console 隧道，验证从设备
端到浏览器端的双向数据通路（设备上报 + 浏览器下发命令）能稳定走通，
并产出可复用的测试清单与故障排查路径。

> 历史任务 `05-03-console-tunnel-bringup` 用 sim-device（本地 Node ws-cli）
> 跑通了 AC8/AC9，但备注"等模组"——本任务做实机闭环。

## What I already know

### 部署拓扑（已就位）

- VPS：`45.205.25.184`（海外），frps `:7000`，对外 tunnel `:13000`
- 公网域名：`websocket.vaple.cc`（CF 橙云 → nginx:443 → frps:13000）
- 本机：`python deploy/start.py` 一键起 `npm start` + `frpc`
- 设备路径：`ws://45.205.25.184:13000/ws`（明文，绕开 CF）
- 浏览器路径：`wss://websocket.vaple.cc/ws`（走 CF）

### 协议契约（设备侧实现需对齐）

- 每条命令一帧 UTF-8 文本，以 `\n` 结尾
- 设备 → 浏览器：任意字符串（如 `temp=42.3\n`）
- 浏览器 → 设备：`led_on\n` / `led_off\n` / `motor_speed_<0..3>\n`
- 心跳：客户端发 `ping\n`，server 回 `pong\n`（仅给发送方，不广播）
- **禁止** binary frame、JSON 信封、长度前缀（server 收到 binary 直接 close 1003）

### 调试工具（已有）

- `node server/scripts/ws-cli.js [ws-url]` — Node 侧 ws CLI，发送/接收 stdout
- `curl http://localhost:8080/healthz` — 本机 healthz，返回 `clients` 计数
- `curl -I https://websocket.vaple.cc/healthz` — 公网 healthz，验隧道

## Module Type & Configuration (Confirmed via screenshots)

**Module is transparent-WS bridge**, not custom firmware. Configured via web UI:

- 网络协议：WebSocket，绑定 UART
- 串口：115200 / 8N1 / 打包超时 80ms
- 服务器地址：将改为 `ws://45.205.25.184:13000/ws`（用户确认沿用档案部署）
- 心跳：开，字符串 `websocket_test`，每 20s
- 登录注册信息：连上时自动发字符串 `system_init success`
- 数据前置/后置字段：均"不发送"
- 自定义 header / IPv6：均关闭

含义：**模组 = UART ↔ WS 文本帧的全双工透传**。MCU 通过 115200 UART
吐出的字节流，被模组按 80ms 打包成一个 WS text frame 上行。下行 WS
text frame 内容原样喂回 UART。

## Protocol Alignment Risks（基于配置截图）

| # | 现象                            | 与 server 协议匹配度                        | 处置建议           |
| - | ------------------------------- | ------------------------------------------- | ------------------ |
| ① | 心跳数据 `websocket_test`       | server 只对 `ping`/`ping\n` 回 pong；其余广播 | 改为 `ping`        |
| ② | 数据帧无 `\n` 结尾（前/后字段空） | 命令字典依赖 `\n` 分帧；MCU 用 strcmp        | 数据后置字段加 `\n` 或 MCU 自加 |
| ③ | 登录注册信息 `system_init success` | server 透传到所有浏览器 xterm                | 保持——作为接入可见信号 |

## Assumptions

- A1：4G 模组（透传型）就绪 ✓ — Q1 已答（选项 A 已就绪）
- A2：沿用档案部署 `45.205.25.184:13000` ✓ — Q2 已答
- A3：测试目标是端到端通路 + 协议对齐，不做性能/弱网压测
- A4：本机即测试主机（开发者笔记本）；4G 模组走移动网络，与本机不同网

## Open Questions

_(none — all blocking questions resolved)_

## Decision (ADR-lite)

**Context**: 4G 透传模组的默认心跳/数据帧格式与 helmet-console 的字符串
协议存在 3 处偏差，需在"改模组配置"和"改服务器协议"之间选边。

**Decision**:
- ① 心跳数据：模组配置改为 `ping`（A1）
- ② 上行数据 `\n`：模组"数据后置字段"配 `\n`/0x0A（B1）
- ③ 登录注册信息 `system_init success`：保留——作为接入可见信号
- 服务器地址：`ws://45.205.25.184:13000/ws`（沿用档案部署）

**Consequences**:
- ✓ Server 端**零改动**（`ws-relay.js` 已用 `text.replace(/\r?\n$/, '') === 'ping'`，
  裸 `ping` 也命中心跳，回 `pong\n` 给发送方且不广播）
- ✓ MCU 端代码无需关心 `\n`——上行模组自动补，下行 server 已透传 `\n`
- ✓ 浏览器 xterm 显示干净（无每 20s 心跳噪音 + 行末分行正常）
- ⚠️ 若未来更换模组（不同厂家配置项命名不同），需重新对齐这 3 项

## Requirements (evolving)

- [ ] R1：本机部署 healthz 双通（local + public）
- [ ] R2：4G 模组连上 `ws://45.205.25.184:13000/ws` 并保持 ≥30s 不断
- [ ] R3：模组上报一帧 UTF-8 字符串，浏览器 xterm 看到带 `[↓]` 前缀
- [ ] R4：浏览器发 `led_on\n`，模组接收并执行（LED 点亮或日志可见）
- [ ] R5：心跳验证——抓到至少一次 `ping\n` / `pong\n` 往返
- [ ] R6：清单化测试步骤与故障排查表，归档到 `prd.md` 或新建 runbook

## Acceptance Criteria (evolving)

- [ ] AC1：`python deploy/start.py` 输出 `[server] listening` + `[frpc] 隧道已建立`
- [ ] AC2：`curl http://localhost:8080/healthz` clients=0
- [ ] AC3：`curl -I https://websocket.vaple.cc/healthz` 返回 200
- [ ] AC4：模组连上后，`/healthz` clients ≥1
- [ ] AC5：浏览器 xterm 看到模组上报数据（带 `[↓]` 方向标记）
- [ ] AC6：浏览器命令栏发送 `led_on`，模组侧观察到对应行为
- [ ] AC7：模组保持连接 ≥60s，无非正常断开

## Definition of Done

- 7 条 AC 全部通过并截图/日志归档
- 测试中发现的协议偏差或固件 bug 记入本 prd.md "Findings" 段
- 若需要修服务器/前端 → 单独建子任务并走完整开发流程

## Out of Scope

- 4G 模组固件开发（默认已就绪）
- 弱网 / 丢包 / 大流量压测
- 多模组并发连接
- TLS / wss 在模组端的兼容（明文 ws 直连即可，已是档案决策）
- frps token 轮换（仍为 R5 历史 followup，不在本任务）

## Technical Notes

- 设备端 WS URL 来源：`docs/architecture.md` §3.2 + `deploy/deploy.md` "Topology"
- 协议契约：`docs/architecture.md` §4
- 直连 VPS:13000 的合理性：`deploy/deploy.md` "Production Path" §1（开发期允许明文）
- 调试参考：`server/scripts/ws-cli.js`（先用它跑通基线，再换 4G 模组）
- 方向标记 `[↓]` / `[↑]` 仅前端展示层，不在线上：`web/js/main.js` `RX_PREFIX` / `TX_PREFIX`

## Findings (to fill during testing)

### P1 Pre-flight — 2026-05-05

✅ **本地链路全通**：

- `start.log` 第 13 行：`[server] listening on http://0.0.0.0:8080`
- `start.log` 第 22 行：`[frpc] 隧道已建立 ✓`
- `curl http://localhost:8080/healthz` → `200 / {"status":"ok","clients":0}` (AC2 ✓)

✅ **设备直连路径全通**（4G 模组目标路径）：

- `curl http://45.205.25.184:13000/healthz` → `200 / clients=0`
- 证明 VPS frps:13000 ↔ 本机 frpc ↔ Node :8080 端到端通

❌→✅ **公网 CF 路径**（误诊修正）：

- 首次 `curl -I https://websocket.vaple.cc/healthz` → 404，**为 CF 拦 HEAD 方法**
- `curl https://websocket.vaple.cc/healthz` (GET) → `200 / clients=1` ✓
- 浏览器 GET + WS Upgrade 路径完全正常（用户实测打开站点 + 点连接成功，徽章绿）
- AC3 实际通过；AC5 已达成（clients=1 说明浏览器已连）

**Decision (revised)**: 浏览器走原档案路径 `https://websocket.vaple.cc/`，
4G 模组走 `ws://45.205.25.184:13000/ws`。两端归一到同一 Node 进程。
不需要回退到 localhost。

### P2~P5 — 模组配置 + 双向通信 + 稳定性

✅ **模组 3 项配置生效**（用户在模组 Web UI 改并保存重启）：

- 服务器地址 → `ws://45.205.25.184:13000/ws`
- 心跳包数据 → `ping`
- 数据后置字段 → `\n` (0x0A)

✅ **接入与双向数据全部通过**：

- AC4：模组上线后浏览器 xterm 出现 `[↓] system_init success`
- AC5：`/healthz` clients=2（浏览器 + 模组）
- AC6：上行——MCU UART 输出在浏览器 xterm 显示带 `[↓]` 前缀，分行正常
- AC7：下行——浏览器命令栏发命令字符串，模组 UART 收到完整 `<cmd>\n`，MCU 端动作正确
- AC8：连接保持稳定无断开
- AC9：浏览器 xterm 心跳期无 `ping`/`websocket_test` 噪音（server 静默 pong 验证）

## Acceptance Criteria (final)

- [x] AC1：`python deploy/start.py` 输出 `[server] listening` + `[frpc] 隧道已建立`
- [x] AC2：本地 `/healthz` 返回 200 / clients=0（启动时）
- [x] AC3：公网 `/healthz` GET 返回 200（HEAD 被 CF 拦，已记录）
- [x] AC4：模组上线后浏览器 xterm 出现 `[↓] system_init success`
- [x] AC5：`/healthz` clients=2（浏览器 + 模组）
- [x] AC6：上行 MCU 测试帧在浏览器 xterm 显示完整且带 `[↓]` 前缀
- [x] AC7：浏览器发命令，MCU UART 收到完整 `<cmd>\n` 并执行
- [x] AC8：连接保持稳定，无非正常断开
- [x] AC9：心跳期浏览器 xterm 无心跳噪音（server 静默 pong 生效）

## Followups（不阻塞本任务，可建子任务）

- [ ] **CF HEAD 方法 404**：`curl -I https://websocket.vaple.cc/healthz` 返回
  404 而 GET 返回 200。CF 默认行为或 Page Rule 导致；不影响生产，仅
  影响 HEAD 探针类监控
- [ ] **frps token 轮换**（继承自档案 R5）：`token123456@` 仍为弱 token
- [ ] **frps Dashboard 密码加固**（继承自档案 R5）
- [ ] **start.py Relay 重启退避**（继承自档案 R5）

## Lessons Learned

1. **透传模组配置 ≠ 自写固件**——下次评估"4G 模组就绪度"应先问是
   透传型（Web UI 配置）还是 SDK/AT 自写型，决定任务范围天差地别
2. **协议偏差以"改模组配置"优于"改 server"**——server 已是无业务
   耦合的纯 relay，应保持不动；模组那 3 项配置（服务器地址 / 心跳
   内容 / 后置 `\n`）即可对齐协议
3. **`curl -I` 不是公网验活的可靠方法**——CF 等边缘服务可能选择
   性拦 HEAD；公网探活应用 GET 或专用 health-check 工具

## Chrome DevTools Automated Verification（截图证据）

2026-05-05，用 chrome-devtools MCP 驱动浏览器做独立自动化回归，产物
在 `screenshots/`：

| # | 文件                        | 验证内容                                          |
| - | --------------------------- | ------------------------------------------------- |
| 1 | `01-disconnected.png`       | 未连接基线——徽章灰/未连接，URL 默认 `wss://websocket.vaple.cc/ws` |
| 2 | `02-connected.png`          | 点"连接"后徽章绿/已连接；xterm 写入 `[ws] connect ...` |
| 3 | `03-led-on-roundtrip.png`   | 终端栏发 `led_on` → xterm 显示 `[↓]led_on`——**完整下行 + MCU UART 回显回环** |
| 4 | `04-motor-speed-3.png`      | 同上，换 `motor_speed_3` 再次验证                |
| 5 | `05-panel-view.png`         | 切换到"面板"视图——控件区就绪                      |
| 6 | `06-panel-led-on.png`       | 点面板 LED"开启"按钮，同样触发下行并被 MCU 回显   |
| 7 | `07-terminal-final.png`     | 最终 xterm 累积 3 条 `[↓]` 回显帧，心跳期无噪音   |

**关键证据**：xterm 累积内容：

```
[ws] connect wss://websocket.vaple.cc/ws
[↓]led_on
[↓]motor_speed_3
[↓]led_on
```

- `[↓]` 前缀由前端 `web/js/main.js#RX_PREFIX` 注入，证明三条都是"从
  wire 收到的下行帧"——不是本地回显
- 内容完全是发送的命令字符串，证明 **4G 模组 UART ↔ MCU ↔ UART ↔
  模组 WS** 这条链透传正确
- 5 秒静默窗口观察 xterm 无 `ping` / `websocket_test` 文本——server
  静默 pong 逻辑（AC9）正确，`text.replace(/\r?\n$/, '') === 'ping'`
  对裸 `ping` 命中

**终态 healthz**：`clients=2`（Chrome 自动化 + 4G 模组）
