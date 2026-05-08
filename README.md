# SearchWise

SearchWise 是一个本地优先的浏览器扩展，用来净化搜索结果、屏蔽低质量内容农场、突出更可信的技术来源。当前路线是低成本试水：免费版不依赖服务器，AI 摘要、账号同步和订阅作为后续可选云服务。

## 当前定位

- 品牌：SearchWise
- 切入点：先服务程序员的技术搜索
- 成本策略：本地免费可用，先不强依赖服务器
- 收费策略：Pro 提供云同步、更多自定义规则、有限 AI 摘要

## 目录结构

```text
F:\demo0422
├─ searchwise-extension  Chrome/Edge 扩展
├─ searchwise-api        Laravel API，可选云服务
└─ searchwise-site       静态官网，可部署到 Cloudflare Pages
```

## 免费版能力

- 支持多个主流搜索结果页面
- 本地内置低质量域名屏蔽规则
- 免费用户可添加 20 个自定义屏蔽域名
- 关键词高亮
- 无需登录，无需服务器

## Pro 试水方案

- 建议月付：¥19.9/月
- 建议年付：¥99/年
- Pro 功能：
  - 无限自定义屏蔽域名
  - 云端同步规则
  - 每月 500 次 AI 摘要
  - 搜索引擎改版时优先修复

## 本地安装扩展

1. 打开 Chrome 或 Edge。
2. 地址栏输入 `chrome://extensions`。
3. 开启“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择 `F:\demo0422\searchwise-extension`。
6. 打开受支持搜索引擎测试搜索结果净化效果。

## 官网部署

`searchwise-site` 是纯静态页面，可以直接部署到 Cloudflare Pages。

Cloudflare Pages 设置：

- Build command：留空
- Build output directory：`searchwise-site`

发布前需要替换：

- `searchwise-site/index.html` 里的 Pro 预约邮箱
- `searchwise-site/privacy.html` 里的联系邮箱
- 扩展上架后，把 `searchwise-site/install.html` 改成商店链接

## 可选 API

Laravel API 位于 `searchwise-api`，主要用于后续云服务：

- 账号注册/登录
- 云端黑名单同步
- AI 摘要
- 订阅管理

当前低成本试水阶段，扩展核心功能不要求 API 在线。

## 验证命令

```powershell
Get-ChildItem -Path searchwise-extension -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
node searchwise-extension\tests\engine-adapter-smoke.test.mjs
node searchwise-extension\tests\manifest-smoke.test.mjs
Get-Content searchwise-extension\manifest.json | ConvertFrom-Json | Out-Null
Get-Content searchwise-extension\_locales\en\messages.json | ConvertFrom-Json | Out-Null
Get-Content searchwise-extension\_locales\zh_CN\messages.json | ConvertFrom-Json | Out-Null
```
