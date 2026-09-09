# Smart Proxy Client

Smart Proxy 是一个仅供个人使用的 Windows 便携代理客户端。项目基于 Neutralinojs，内置 sing-box，并保留当前个人订阅、离线节点与运行配置。

> **历史凭据警告**：旧版本源码历史和 Release 含真实订阅地址、节点凭据与个人路径信息。v1.1.0 起的新产物不再内嵌个人配置，但这不会撤销历史暴露；若仓库曾公开，应轮换旧订阅与节点凭据。

## Portable EXE

GitHub Actions 使用固定版本的 Neutralinojs CLI，将网页资源和 sing-box 1.13.13 嵌入 `smart-proxy-client-win_x64.exe`，并验证未嵌入个人配置。升级继续读取 EXE 同目录的 `smart-proxy-data`，不会覆盖已有订阅、离线 YAML 或设置。全新目录首次使用需导入自己的订阅。

本地构建要求 Node.js 22 或更高版本：

```text
npm ci
npm test
npm run build:portable
npm run verify:portable
```

产物位于 `dist/smart-proxy-client/smart-proxy-client-win_x64.exe`，校验文件为同目录的 `SHA256SUMS.txt`。

## CI/CD

- 推送到 `main`：执行测试、可复现构建和隐藏窗口运行验证。
- 推送 `v*` 标签：完成同样验证后创建私有 GitHub Release，并上传 EXE 与 SHA-256。
- `private-config.manifest.json` 仅用于验证个人配置未进入 EXE；源码历史中的个人文件尚需单独治理。日志、WebView 缓存、锁文件和测速临时文件不会提交。

## 测速与运行行为

- 每轮固定所选模型和一个账户，最多 4 路并发；每个实际请求有独立 30 秒超时。初筛每节点一次，前 3 名各追加 2 次，只有至少 3 次全成功的同条件成绩才显示为本轮复测候选，同时展示波动范围，不保证未来速度。会消耗所选账户的正常额度。
- tok/s 是实际 API usage 除以请求启动到最后正文的端到端耗时，不是纯模型解码速度。TTFT 从首个非空正文事件计时；缺失 usage、断流、错误事件或错误模型均不产生新成绩。不同模型/账户不共排冠军。
- 停止会取消队列并终止正在测量的 curl。失败、取消、账户异常和整轮异常单独记录，不删除上次成功成绩。测速不会切换节点、重启代理或清理活动连接。
- Anthropic 可达性未测量时明确为未知；系统 DNS 的 A/AAAA 结果只作诊断，不封禁入口或触发自动更新。
- 首页可“移除离线 YAML”：仅移除来源，保留原文件，运行配置留待下次手动启动应用。不要通过删除原文件间接移除订阅。
- 日志按批写入，队列最多 256 KiB；超过上限会记录丢弃原因。新日志每文件最多 8 MiB，保留当前和两份轮转；首次遇到的旧超大日志移入运行目录 `_历史版本`，不删除。
- 后台连接轮询间隔 15 秒，连接页可见时为 2 秒；请求超时 5 秒，不重叠，不因控制器读失败直接重启核心。

## 第三方组件

Neutralinojs、sing-box、Noto Sans CJK 与 js-yaml 的许可信息见 `THIRD_PARTY_NOTICES.md`。本项目自身未授权公开分发。
