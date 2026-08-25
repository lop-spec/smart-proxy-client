# Smart Proxy Client

Smart Proxy 是一个仅供个人使用的 Windows 便携代理客户端。项目基于 Neutralinojs，内置 sing-box，并保留当前个人订阅、离线节点与运行配置。

> **私密仓库警告**：仓库和 Release 含真实订阅地址、节点凭据与个人路径信息。不要改为公开、添加协作者或复制到不受信任的位置；若意外公开，应立即轮换全部订阅与节点凭据。

## Portable EXE

GitHub Actions 使用固定版本的 Neutralinojs CLI，将网页资源、sing-box 1.13.13 和私有配置嵌入 `smart-proxy-client-win_x64.exe`。首次启动会在 EXE 同目录创建 `smart-proxy-data`，仅当本地文件不存在时恢复内置配置，因此升级不会覆盖已修改的设置。

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
- `private-config.manifest.json` 明确列出随源码和 EXE 保存的个人配置；日志、WebView 缓存、锁文件和测速临时文件不会提交。

## 第三方组件

Neutralinojs、sing-box、Noto Sans CJK 与 js-yaml 的许可信息见 `THIRD_PARTY_NOTICES.md`。本项目自身未授权公开分发。
