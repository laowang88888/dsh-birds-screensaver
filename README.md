# dsh-birds-screensaver

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 桌面端用的**鸟类群集锁屏屏保**：空闲后全屏显示 boids 群集动画（3 个鸟群 + 2 只猎鹰），输入密码解锁。

> **English summary**: A boids flock screensaver and password lock screen for the DeepSeek Harness desktop app. Clone, run `node install.mjs`, restart DSH. Configurable default password and idle timeout.

<p align="center">
  <a href="https://laowang88888.github.io/dsh-birds-screensaver/"><b>▶ 在线预览（GitHub Pages）</b></a>
  &nbsp;·&nbsp;
  <a href="preview.html">本地预览 preview.html</a>
</p>

---

## 特性

- **boids 群集动画**：3 个鸟群（冰蓝 / 琥珀 / 紫罗兰）各自保持队形、互相穿插；2 只猎鹰主动追捕，鸟群会四散后重新聚拢
- **锁屏**：空闲自动锁定、手动锁定、密码解锁、锁屏内修改密码
- **无外部依赖**：纯 canvas + 原生 JS，不需要构建、不下载任何资源
- **可配置**：默认密码、空闲时间都从插件配置读取
- **升级友好**：插件文件放在 `~/.dsh/local-plugins`，通过 junction 挂载，DSH 升级不会覆盖
- **跨平台**：Windows / macOS / Linux（DSH 桌面端均可）

---

## 快速开始

```bash
git clone <this-repo> dsh-birds-screensaver
cd dsh-birds-screensaver
node install.mjs            # 可选参数见下
```

然后**重启 DeepSeek Harness**。右下角会出现一个 🔒 按钮。

### 安装脚本做了什么

`install.mjs` 幂等地执行两步：

1. 创建链接：`<DSH_HOME>/profiles/node_modules/@local/birds-screensaver` → 本仓库目录
   - Windows 用 junction，macOS/Linux 用 symlink
2. 在 `<DSH_HOME>/profiles/desktop/cordis.patch.yml` 末尾追加注册段（已存在则跳过，配置不动）

`DSH_HOME` 默认 `~/.dsh`，可用环境变量覆盖。

### 参数

```bash
node install.mjs --profile desktop --password 1234 --idle-ms 180000
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--profile` | `desktop` | DSH profile 名 |
| `--password` | `1234` | 默认解锁密码 |
| `--idle-ms` | `180000` | 空闲多久锁定（毫秒，≥10000） |

---

## 配置

注册段位于 `~/.dsh/profiles/desktop/cordis.patch.yml` 末尾：

```yaml
- insert:
    - id: birds-screensaver
      name: "@local/birds-screensaver"
      config:
        defaultPassword: "1234"   # 默认解锁密码
        idleMs: 180000            # 空闲锁定时间（毫秒）
```

改完重启 DSH 生效。

### 密码优先级

```
用户改过的密码（localStorage） > defaultPassword > 内置 1234
```

### 空闲时间优先级

```
localStorage 'dsh-birds-idle-ms' > idleMs > 180000
```

---

## 使用

| 操作 | 方式 |
|---|---|
| 锁定 | 点右下角 🔒；或 `Ctrl+Shift+L` / `Ctrl+Alt+L` |
| 解锁 | 输入密码 + 回车 |
| 改密码 | 锁屏界面底部「修改密码」（需验证当前密码，新密码 ≥4 位） |
| 自动锁定 | 空闲达到 `idleMs` |

### 重置密码（忘记时）

开发者工具（F12）Console：

```js
localStorage.removeItem("dsh-lock-password")   // 回到配置的默认密码
localStorage.removeItem("dsh-birds-idle-ms")   // 回到配置的空闲时间
```

---

## 工作原理

```
cordis.patch.yml 的 config
        │
        ▼
宿主半 lib/index.js  ← 能拿到 Loader config
        │  注册 GET /plugins/birds-screensaver/config
        ▼
客户端半 lib/client.js  ← 拿不到 Loader config，启动时 fetch 拉取
        │
        ▼
锁屏 UI + boids 动画
```

- DSH 的客户端模块系统创建 entry 时只传 `{ name }`，**客户端插件拿不到 config**，所以由宿主半通过 HTTP 路由转交。
- 宿主半声明 `inject: ["webServer"]`，用 `ctx.webServer.register({ kind: "exact", path, handler })` 注册路由。

### 关键坑：patch 必须是 `insert` 形式

`cordis.patch.yml` 的语义是：

- **非 `insert` 的行只能覆盖已存在的 entry**；
- 新增插件必须写成 `- insert:`，否则 `id` 不存在时会被**静默跳过**（只在日志里 warn，不会报错）。

这就是为什么注册段长这样：

```yaml
- insert:
    - id: birds-screensaver
      name: "@local/birds-screensaver"
```

---

## 故障排查

| 现象 | 处理 |
|---|---|
| 重启后没有 🔒 按钮 | 确认 patch 是 `insert` 形式；确认 junction 存在；`node --check lib/*.js` |
| 有按钮但快捷键无效 | 用按钮锁定；换 `Ctrl+Alt+L`；检查是否被其他软件占用 |
| 密码不对 | 先试 1234；清 `localStorage['dsh-lock-password']` |
| 空闲不触发 | 清 `localStorage['dsh-birds-idle-ms']`；确认 `idleMs ≥ 10000` |
| 动画卡顿 | 调小 `lib/client.js` 里的 `N`（默认 420） |

### 自检

```bash
node --check lib/index.js
node --check lib/client.js
node -e "import('./lib/index.js').then(m => console.log(Object.keys(m)))"
```

---

## 卸载

```bash
node uninstall.mjs
```

或手动：删除 `cordis.patch.yml` 里的 `insert` 段 + 删除 `profiles/node_modules/@local/birds-screensaver` 链接。

---

## 自定义

动画参数都在 `lib/client.js` 顶部：

| 参数 | 默认 | 作用 |
|---|---|---|
| `N` | 420 | 鸟的数量 |
| `HAWK_COUNT` | 2 | 猎鹰数量（0 关闭） |
| `FLOCKS` | 3 组 HSL | 鸟群配色 |
| `PERCEPTION` / `SEPARATION` | 64 / 28 | 群集感知 / 排斥半径 |
| `MAX_SPEED` / `MAX_FORCE` | 2.6 / 0.07 | 飞行速度 / 转向力 |
| `HAWK_SPEED` / `HAWK_FLEE` | 3.7 / 190 | 猎鹰速度 / 鸟的逃逸半径 |

改完重启 DSH。

---

## 安全边界

这是**客户端锁屏**：密码存在浏览器 `localStorage`，本质是 UI 遮罩。

- ✅ 能挡住同事/家人随手查看
- ❌ 防不住开发者工具或进程级操作，也不加密任何数据

**真正敏感的数据请配合系统锁屏**（`Win + L` / `Ctrl+Cmd+Q`）。

---

## 兼容性

- 需要支持 **client plugin**（`dsh.client`）的 DeepSeek Harness 版本
- 已在 DSH 桌面端（Windows）验证
- 插件不依赖 DSH 内部包，只用 `ctx.effect` / `ctx.webServer` 公开服务

---

## 致谢与许可

- 动画灵感来自 [cbirds](https://github.com/clainstone/cbirds)（MIT），本项目重写为浏览器 canvas 版本
- 本项目以 [MIT](LICENSE) 许可发布
