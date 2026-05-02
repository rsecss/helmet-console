# Console tunnel bringup via frp

## Goal

把 helmet-console 通过已有的 frp 隧道 + CF 子域名 + nginx 反代暴露到公网，
验证浏览器（CF 橙云 wss）和（未来）4G 下位机（直连 VPS:13000 ws 明文）
两条路径都能连到本机 Node 服务。

> 这是开发期联调验证，**不是**生产部署。

## What I already know

代码勘察 + 上下文对话得出的事实：

### helmet-console 项目

- Server 默认监听 `:8080`（`server/src/config.js:24`）
- HTTP + WS 共用同一进程同一端口，`/ws` 由 `ws-relay.js` 接管
- 启动命令是 `npm start`（`package.json:8`）
- 前端 `defaultUrl()` 从 `window.location` 推导 ws URL（`web/js/config-panel.js:17-22`）

### 已有部署资源（用户已搭好）

- VPS：`45.205.25.184`（海外）
- frps：服务端口 `7000`、Dashboard 端口 `7500`、token `token123456@`
- 子域名：`websocket.vaple.cc`（CF DNS + 橙云 + VPS nginx 反代到 frps:13000）
- 旧 `deploy/frpc.toml`：`localPort=3000`、`remotePort=13000`
- 旧 `deploy/start.py`：用 `pnpm dev`（与 helmet-console 不匹配）

### 发现的隐藏 bug

- `web/js/config-panel.js:21`：`port = window.location.port || '8080'`
  在 CF 站点（标准端口、无显式 port）下会推导出
  `wss://websocket.vaple.cc:8080/ws`，连接 404

## Requirements

实施 4 条改动 + 标记 1 条后续：

- [x] **R1**：`deploy/frpc.toml` `localPort` 从 `3000` 改为 `8080`
- [x] **R2**：`deploy/start.py` 修复 5 处不匹配/反模式
  - `RELAY_PORT = 3000` → `8080`
  - `pnpm` 替换为 `npm`
  - `dev` 替换为 `start`
  - 移除 `stdout/stderr=DEVNULL`，让 `[server]` 日志可见
  - 公网访问提示从占位符改为真实 URL（顶部常量）
- [x] **R3**：修 `web/js/config-panel.js` defaultUrl port fallback bug
  - 同步：`spec/frontend/quality-guidelines.md` §4 增加 3 条 defaultUrl
    端口推导契约 + §5 增加 1 条 "defaultUrl over-default" Bad case
- [x] **R4**：`deploy/frpc.toml` 移到 .gitignore，新建 `deploy/frpc.example.toml`
- [ ] **R5（暂缓）**：安全加固——见下方 Pending Followups

## Acceptance Criteria

启动后依次 PASS（已自动化测试通过）：

- [x] AC1：`python deploy/start.py` 启动后输出 `[server] listening on http://0.0.0.0:8080`
- [x] AC2：`curl http://localhost:8080/healthz` 返回 200 + `{"status":"ok",...}`
- [x] AC3：脚本输出 `[frpc] 隧道已建立 ✓` 或同等信息
- [x] AC4：`curl -I https://websocket.vaple.cc/healthz` 返回 200（经 CF AMS 边缘）
- [x] AC5：浏览器访问 `https://websocket.vaple.cc/` 看到 helmet console UI
- [x] AC6：浏览器侧 URL 输入框默认值为 `wss://websocket.vaple.cc/ws`（**没有** `:8080`）
- [x] AC7：浏览器点连接，状态徽章变绿"已连接"，clients 计数 +1
- [x] AC8：sim-device 连 `ws://45.205.25.184:13000/ws` 成功
- [x] AC9：sim-device 发 device data 帧，浏览器 xterm 显示 payload

## Definition of Done

- 全部 9 条 AC 通过
- `npm run lint` 全绿
- `npm run format:check` 全绿
- `npm test`（lint + smoke）全绿
- `frpc.toml` 不再被 git 追踪
- `frpc.example.toml` 字段完整且无真实凭据
- 本 PRD 末尾 Pending Followups 已记录

## Out of Scope

- frps token 轮换、Dashboard 密码加固（→ R5）
- git 历史 token 清理（BFG / filter-repo）（→ R5）
- 4G 模组实机联调（等模组）
- 模组 wss 兼容性验证（本次绕开，下位机走明文 :13000）
- 生产部署形态（systemd 守护、监控、灰度）
- frp 自身长期稳定性补丁（systemd Restart、退避优化）
- `deploy/start.py` 的 Relay 重启退避（review 报告已列，未在本次 4 项内）

## Technical Approach

部署拓扑：

```
[浏览器] ─wss://websocket.vaple.cc/ws─→ CF 边缘 ─→ VPS nginx:443
                                                       │ proxy_pass
                                                       ▼
                                                  VPS frps:13000
                                                       │ frp tunnel
                                                       ▼
                                                  本机 frpc → :8080 Node

[下位机] ─ws://45.205.25.184:13000/ws─→ 直连 VPS:13000（绕开 CF）
                                          ↓
                                      frps → frpc → :8080
```

**关键设计**：浏览器和下位机走**不同入口**但**同一 Node 进程**——
利用 `ws-relay.js:69-73` 所有 client 平等的特性。

## Decision (ADR-lite)

**Context**：开发期联调；VPS 在海外；模组 wss 支持未确认；CF 橙云对 WS 强制 TLS。

**Decision**：方案 B 混合——
浏览器走 `wss://websocket.vaple.cc/ws`（CF + nginx），
下位机走 `ws://45.205.25.184:13000/ws`（IP 直连），
共享 frps:13000 → frpc → 本机 :8080 后端。

**Consequences**：

- ✓ 浏览器侧体面（https + 域名 + CF 防护）
- ✓ 下位机侧绕开模组 wss 兼容问题
- ✓ 单一 frp 隧道、单一 Node 进程
- ✗ 下位机流量明文（开发期可接受，载荷无敏感数据）
- ✗ :13000 公网暴露面（开发期可接受）

转生产路径：模组确认支持 wss 后，把下位机也切到 `wss://websocket.vaple.cc/ws`，
关掉 :13000 直连暴露。架构无需重写。

## Technical Notes

### 文件清单

| 文件                          | 作用             | 改动                |
| ----------------------------- | ---------------- | ------------------- |
| `deploy/frpc.toml`            | frp 客户端配置   | 改 1 行 + 移 ignore |
| `deploy/frpc.example.toml`    | 配置模板         | 新建                |
| `deploy/start.py`             | 一键启动脚本     | 改 5 处             |
| `web/js/config-panel.js`      | 前端 URL 默认值  | 改 1 处             |
| `.gitignore`                  | git 忽略规则     | 加 1 条             |

### 关键代码位置

- `server/src/config.js:24` — server 默认端口
- `web/js/config-panel.js:17-22` — `defaultUrl()` 推导逻辑
- `web/js/config-panel.js:47-75` — `parseWsUrl()` 已规范化标准端口（443/80 会被去除），
  所以 `defaultUrl` 输出带不带端口都会被 `parseWsUrl` 收敛
- `server/src/ws-relay.js:69-73` — 广播逻辑（all clients 平等）
- `deploy/start.py:31` — RELAY_PORT
- `deploy/start.py:108-124` — start_relay()
- `deploy/start.py:139-147` — start_frpc()
- `deploy/start.py:209` — 公网访问提示

### Spec 一致性

`spec/frontend/state-management.md` + `spec/frontend/quality-guidelines.md`
规定 URL 读取顺序：`console.ws.url` → legacy fields → `defaultUrl()`。
`defaultUrl()` 是兜底层，spec **未规定**其内部端口推导细节，
本次 R3 修复完全落在 spec 允许范围内。

### 已知坑

1. CF 橙云对 WS 的 TLS 强制：浏览器 wss 链路要求 nginx + CF 都正确处理 upgrade 头
2. port fallback bug（已在 R3 修复）
3. token 已泄漏到 git 历史 + 截图 + 对话——R5 必须做

## Pending Followups (R5 — 测试通过后启动新 task)

1. VPS 上生成强 token：`openssl rand -hex 32`
2. 更新 frps 配置 + 重启 frps
3. 更新 Dashboard 密码（弱密码 `admin_KQriQa` 替换）
4. 同步本地 frpc.toml 到新 token
5. 评估 git 历史清理：
   - 仓库公开 → 必须 BFG / filter-repo + force push
   - 仓库私有但有协作者 → 建议清理
   - 仓库私有且仅个人 → 可暂缓但需登记
6. 决定是否给 frps 加 systemd `Restart=always`、frpc 加守护
7. 决定是否给 Relay 重启加指数退避（`deploy/start.py:218-225`）
