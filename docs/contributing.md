# Contributing

> 本项目目标是**极轻量**的 WebSocket 转发上位机系统。改动遵循 KISS，不引入与目标无关的复杂度。

---

## 启动开发环境

```bash
npm install            # 一次性，安装 dev 依赖 + 自动注册 git hooks
npm run format:check   # 验证代码格式
```

`npm install` 会触发 `prepare` 脚本，调用 `simple-git-hooks` 把 `commit-msg` 钩子写入 `.git/hooks/`。无需 husky。

---

## 分支策略：GitHub Flow

```
main      ◄── 受保护，仅由 PR 合入；始终可发布
 │
dev       ◄── 集成分支（首版可直接基于 dev 拉 feature）
 │
feat/<scope>-<short-desc>   ◄── 新功能
fix/<scope>-<short-desc>    ◄── 问题修复
docs/<scope>                ◄── 纯文档
chore/<scope>               ◄── 构建/工具/杂项
```

* 单人项目期间：可直接在 `dev` 工作；阶段性 PR 合入 `main`
* 合作期间：`feat/*` → PR → `dev` → 集成验证 → PR → `main`
* 禁止：`force push` 到 `main` / `dev`；`--no-verify` 跳过 hooks

---

## 提交规范：Conventional Commits

格式：`<type>(<scope>): <subject>`

| type | 何时用 |
|---|---|
| `feat` | 新功能 |
| `fix` | 问题修复 |
| `docs` | 文档（README、架构、注释） |
| `refactor` | 不改外部行为的重构 |
| `chore` | 构建/工具/依赖更新 |
| `test` | 测试相关 |
| `style` | 仅格式化（不应频繁出现，平时 prettier 已自动） |

**好例子**：

```
feat(server): add ws relay broadcast
fix(web): reconnect not triggered on 1006
docs(architecture): clarify heartbeat semantics
chore: bump prettier to 3.3
```

**坏例子**（commitlint 会拒）：

```
update                  # 无 type
Feat: add x             # type 必须小写
feat: ADD STUFF         # subject 句首大写不强制，但要简洁
```

---

## 代码风格：Prettier

* 配置见 `.prettierrc.json`：单引号 · semi · 100 列 · LF
* 日常：编辑器装 Prettier 插件，保存自动格式化
* 提交前：`npm run format`（修改） 或 `npm run format:check`（仅检查）

`.editorconfig` 兜底：UTF-8 / LF / 2-space / final newline。任何编辑器都该遵守。

---

## 提交前自动检查（simple-git-hooks）

`commit-msg` 钩子调用 `commitlint`，校验提交信息符合 Conventional Commits。

如果 hook 没生效（克隆后忘记装依赖），手动执行：

```bash
npm run prepare
```

---

## 文件编码 / 行尾

* 一律 **UTF-8（无 BOM）+ LF**
* `.gitattributes` 已强制 `* text=auto eol=lf`
* Windows 用户：Git 自动处理；编辑器若产生 CRLF，保存即被 Prettier/EditorConfig 拉回

---

## 不做的事（边界）

* 不引入 ESLint，直到 P2 后端代码落地（避免空 lint）
* 不引入构建工具（Vite/Webpack 等）
* 不引入测试框架，直到核心 relay 函数稳定（v0.2）
* 不在 `main` 直接 commit
