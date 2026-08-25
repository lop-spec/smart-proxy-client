# Smart Proxy v35 · 免打包快速迭代架构

## 目录即应用（便携）

整个文件夹复制到任何 Win10/11 电脑即可运行，无外部依赖（仅用系统自带 powershell.exe 与 WebView2）。

```
smart-proxy-client-v35\
├─ smart-proxy-client-win_x64.exe   Neutralino 运行时（绿色单文件）
├─ smart-proxy-launcher.vbs         日常入口（单实例唤醒 + --load-dir-res 启动）
├─ resources\                       ← 源码即运行时，改完即生效
│  ├─ index.html / styles.css       UI
│  ├─ js\main.js                    应用逻辑
│  ├─ js\config-helpers.js          sing-box 配置生成
│  ├─ scripts\upload-probe.ps1      测速 worker（CF 上行 + Claude 探针）
│  └─ bin\sing-box.exe              内置内核兜底
├─ smart-proxy-data\                运行数据（settings/内核/日志），换机自动 rebase 路径
├─ dev\restart.cmd                  改完代码一键重启生效
├─ dev\snapshot.cmd                 快照 resources\ 到 backups\（回滚点）
└─ dev\rollback.cmd                 回滚到最新快照并重启
```

没有 resources.neu 打包体：应用以 `--load-dir-res` 直接从 `resources\` 目录加载。

## 改代码流程（对比 v34 的 打包→替换→pending 交换）

1. 改 `resources\` 下任意文件
2. 双击 `dev\restart.cmd`（只重启 v35 实例，不影响其他版本）
3. 看效果；满意后 `dev\snapshot.cmd` 留一个回滚点
4. 改坏了 → `dev\rollback.cmd`

本机装了 git 的话，目录内已 init 仓库，可用 git 做更细的版本管理；git 不是运行或回滚的必需品。

## 换电脑

整个文件夹复制过去 → 双击 launcher → 设置里勾"开机自动静默启动"（自启动是注册表项，应用启动时自动写入当前路径）。

## 测速原理（v35 起）

- 上行吞吐：随机数据 POST `https://speed.cloudflare.com/__up`（与 claude.ai 同一 Cloudflare 边缘网络），
  HTTP 200 = 服务端收完确认；三请求设计（预热建连 / 大包计时 / 空包测 RTT），上行时间 = 大包耗时 − RTT。
- Claude 可达性：无 key POST `https://api.anthropic.com/v1/messages`，401 = 出口可达；403 = 出口被 Anthropic/WAF 拒绝，
  该节点测速再快也会沉底且不参与自动切换。
- 排名：初筛 256 KiB 全节点 → TOP3 决赛 1 MiB × 2 复测取中位数 → 冠军自动切换（仅 Claude 可达节点）。
- 探测端口 40919-40921（v34 用 40909，两版可共存）。
