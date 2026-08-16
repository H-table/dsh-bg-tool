# @local/dsh-bg-tool — 抠图工具插件

DeepSeek Harness 持久化插件：本地 rembg GPU 抠图（**remove_background** 工具）。

## 功能
- 三档模型：`general`（BiRefNet-general fp16）/ `portrait`（BiRefNet-portrait fp16）/ `fast`（u2netp）
- 插件配置卡（设置 → 插件 → 插件配置 →「背景抠图」）：模型映射下拉、输出目录、
  服务器自启动开关，官方卡片同款 UI（暂存编辑、已覆盖标记、恢复默认）
- 服务器生命周期自管理：DSH 启动自动拉起（pythonw 无窗口），停止自动回收
- 热调用 0.7~0.8s/张（RTX 3070）

## 文件
- `lib/index.js` — 宿主：设置命名空间 + 自有设置路由（GET 分层快照 / POST 字段级 mutate）+ 工具注册 + 服务器管理
- `lib/client.js` — 客户端：插件配置卡片（官方 CardForm 语义，数据走自有路由；settings wire
  只服务硬编码白名单命名空间，第三方插件需自建路由）
- `cordis.patch.yml` — bundle patch（注入宿主组合）

## 安装（本机 profile）
```json
// ~/.dsh/profiles/web/package.json
"dependencies": { "@local/dsh-bg-tool": "link:<本目录>" },
"dsh": { "profile": { "bundles": ["@local/dsh-bg-tool"] } }
```
并建立 `node_modules/@local/dsh-bg-tool` → 本目录 的符号链接。

## 依赖的本地环境
`.bg-tools/` 目录（venv + 模型 + bg_server.py），详见仓库根目录 DSH-TOOLBOX.md。
