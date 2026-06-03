# SearchWise Site

这是 SearchWise 的轻量官网，适合直接部署到 Cloudflare Pages。

## 本地预览

直接用浏览器打开 `index.html` 即可。

## Cloudflare Pages 部署

1. 登录 Cloudflare。
2. 进入 Workers & Pages。
3. 创建 Pages 项目。
4. 连接仓库，或者选择 Direct Upload。
5. 构建设置保持为空：
   - Build command: 留空
   - Build output directory: `searchwise-site`
6. 部署后绑定自己的域名。

## 发布前要替换

- `index.html` 里的 Pro 预约邮箱。
- `privacy.html` 里的联系邮箱。
- 扩展上架后，把 `install.html` 的开发者模式说明换成商店链接。线上链接建议使用 `/install` 和 `/privacy` 这种无后缀路径。
