#!/usr/bin/env python3
"""
WebSocket Relay 一键启动脚本（跨平台）

启动 Relay 服务(:3000) + frpc 隧道，自动处理端口清理和启动顺序。
支持 Windows / macOS / Linux。

用法：
    python start.py          # 启动 Relay + frpc
    python start.py --local  # 仅启动 Relay（不启动 frpc）
"""

import io
import os
import sys
import time
import shutil
import signal
import socket
import subprocess
from pathlib import Path

# Windows 终端强制 UTF-8 输出
if sys.platform == "win32":
    os.system("")  # 启用 ANSI
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── 配置 ──────────────────────────────────────────────────

RELAY_PORT = 8080
RELAY_STARTUP_TIMEOUT = 20  # 秒
FRPC_CONFIG = "frpc.toml"

# 公网访问 URL（与 deploy/frpc.toml + nginx 反代规则保持一致）
# TODO 临时联调用值（vaple.cc 个人域名 / 45.205.25.184 个人 VPS）；
#      生产域名/IP 决策后，在本仓搜全部出现位置替换。
#      当前状态登记见 deploy/deploy.md「Current Test Environment」。
PUBLIC_HTTP_URL = "https://websocket.vaple.cc"
PUBLIC_WS_URL = "wss://websocket.vaple.cc/ws"
DEVICE_WS_URL = "ws://45.205.25.184:13000/ws"

# ── 路径 ──────────────────────────────────────────────────

DEPLOY_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DEPLOY_DIR.parent
FRPC_TOML = DEPLOY_DIR / FRPC_CONFIG

# ── 子进程收集 ────────────────────────────────────────────

children: list[subprocess.Popen] = []


def log(tag: str, msg: str):
    print(f"  [{tag}] {msg}", flush=True)


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def wait_for_port(port: int, timeout: int) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_in_use(port):
            return True
        time.sleep(0.5)
    return False


def kill_port(port: int):
    """杀掉占用指定端口的进程"""
    if not port_in_use(port):
        return
    log("清理", f"端口 {port} 被占用，正在释放...")
    if sys.platform == "win32":
        result = subprocess.run(
            ["netstat", "-ano"],
            capture_output=True, text=True,
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTEN" in line:
                parts = line.split()
                pid = parts[-1]
                subprocess.run(
                    ["taskkill", "/F", "/PID", pid],
                    capture_output=True,
                )
    else:
        subprocess.run(
            ["fuser", "-k", f"{port}/tcp"],
            capture_output=True,
        )
    time.sleep(1)


def find_frpc() -> str | None:
    """查找 frpc 可执行文件"""
    name = "frpc.exe" if sys.platform == "win32" else "frpc"

    # deploy 目录下
    local = DEPLOY_DIR / name
    if local.is_file():
        return str(local)

    # PATH 中
    found = shutil.which(name)
    if found:
        return found

    return None


def start_relay() -> subprocess.Popen:
    """启动 Relay 服务"""
    log("Relay", "启动服务...")

    npm_bin = shutil.which("npm")
    if not npm_bin:
        log("ERROR", "找不到 npm，请先安装 Node.js 18+")
        sys.exit(1)

    # 不重定向 stdout/stderr，让 [server] 日志直接打到当前终端
    proc = subprocess.Popen(
        [npm_bin, "start"],
        cwd=str(PROJECT_ROOT),
    )
    children.append(proc)
    return proc


def start_frpc() -> subprocess.Popen | None:
    """启动 frpc 隧道"""
    frpc_bin = find_frpc()
    if not frpc_bin:
        log("WARN", f"找不到 frpc，跳过隧道（仅本地访问）")
        log("WARN", f"下载: https://github.com/fatedier/frp/releases")
        return None

    if not FRPC_TOML.is_file():
        log("WARN", f"找不到 {FRPC_TOML}，跳过隧道")
        return None

    log("frpc", "启动隧道...")
    # 同样保留 frpc 的输出，方便看 token 错误 / 服务器不可达等失败原因
    proc = subprocess.Popen(
        [frpc_bin, "-c", str(FRPC_TOML)],
        cwd=str(DEPLOY_DIR),
    )
    children.append(proc)
    return proc


def cleanup(*_):
    """优雅关闭所有子进程"""
    print("\n")
    log("停止", "正在关闭所有服务...")
    for proc in reversed(children):
        if proc.poll() is None:
            try:
                proc.terminate()
                proc.wait(timeout=5)
            except Exception:
                proc.kill()
    log("停止", "已全部关闭")
    sys.exit(0)


def main():
    local_only = "--local" in sys.argv

    print()
    print("  ┌─────────────────────────────────────┐")
    print("  │   WebSocket Relay 一键启动          │")
    if local_only:
        print("  │   模式: 仅本地                      │")
    else:
        print("  │   模式: Relay + frpc 隧道           │")
    print("  └─────────────────────────────────────┘")
    print()

    # 注册退出信号
    signal.signal(signal.SIGINT, cleanup)
    signal.signal(signal.SIGTERM, cleanup)

    # 1) 清理端口
    kill_port(RELAY_PORT)

    # 2) 启动 Relay
    relay_proc = start_relay()

    log("Relay", f"等待端口 {RELAY_PORT} 就绪...")
    if not wait_for_port(RELAY_PORT, RELAY_STARTUP_TIMEOUT):
        log("ERROR", f"Relay 启动超时（{RELAY_STARTUP_TIMEOUT}s）")
        cleanup()
    log("Relay", "服务就绪 ✓")

    # 3) 启动 frpc
    frpc_proc = None
    if not local_only:
        frpc_proc = start_frpc()
        if frpc_proc:
            time.sleep(2)
            if frpc_proc.poll() is not None:
                log("WARN", "frpc 启动失败，请检查 frpc.toml 配置")
            else:
                log("frpc", "隧道已建立 ✓")

    # 4) 输出信息
    print()
    log("就绪", f"本地访问: http://127.0.0.1:{RELAY_PORT}")
    if frpc_proc and frpc_proc.poll() is None:
        log("就绪", f"公网访问: {PUBLIC_HTTP_URL}")
        log("就绪", f"WebSocket: {PUBLIC_WS_URL}")
        log("就绪", f"下位机直连: {DEVICE_WS_URL}")
    print()
    log("提示", "按 Ctrl+C 停止所有服务")
    print()

    # 5) 阻塞等待，监控子进程
    try:
        while True:
            # 检查 Relay 是否意外退出
            if relay_proc.poll() is not None:
                log("ERROR", "Relay 服务意外退出，正在重启...")
                children.remove(relay_proc)
                relay_proc = start_relay()
                if not wait_for_port(RELAY_PORT, RELAY_STARTUP_TIMEOUT):
                    log("ERROR", "Relay 重启失败")
                    cleanup()
                log("Relay", "重启成功 ✓")

            # 检查 frpc 是否意外退出
            if frpc_proc and frpc_proc.poll() is not None:
                log("WARN", "frpc 断开，5秒后重连...")
                children.remove(frpc_proc)
                time.sleep(5)
                frpc_proc = start_frpc()

            time.sleep(3)
    except KeyboardInterrupt:
        cleanup()


if __name__ == "__main__":
    main()
