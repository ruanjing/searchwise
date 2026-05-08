# SearchWise Store Listing

## Name

SearchWise

## Short Description

Clean search results by hiding low-quality content farms and highlighting useful technical sources.

## Detailed Description

SearchWise is a local-first browser extension that helps you make search results easier to scan.

It works on major search engines including Google, Bing, Baidu, DuckDuckGo, Sogou, 360 Search, and Yandex. SearchWise can hide low-quality content farms, repeated mirrors, and noisy results, while keeping useful sources easier to find.

Core features:

- Hide low-quality search results with built-in cleanup rules.
- Add your own blocked domains locally.
- Highlight search keywords inside result titles and snippets.
- Use the extension without creating an account.
- Keep the free version local-first and lightweight.

SearchWise does not sell user data, does not inject third-party ads into search results, and does not track users across websites.

## Chinese Description

SearchWise 是一个本地优先的浏览器扩展，用来净化搜索结果、隐藏低质量内容农场，并高亮搜索关键词。

它支持 Google、Bing、百度、DuckDuckGo、搜狗、360 搜索和 Yandex。免费版无需账号即可使用，屏蔽规则和自定义域名保存在浏览器本地。

核心功能：

- 隐藏低质量搜索结果和内容农场。
- 添加自定义屏蔽域名。
- 高亮搜索关键词。
- 无需账号即可使用。
- 不在搜索结果页插入第三方广告。

## Category

Productivity

Alternative: Developer Tools

## Website

https://searchwise-6na.pages.dev

## Privacy Policy

https://searchwise-6na.pages.dev/privacy.html

## Support Email

ruanjing40783008@126.com

## Permission Justification

### storage

Used to store user settings, local cleanup rules, language preference, and locally blocked domains.

### activeTab

Used only when the extension popup interacts with the current search tab.

### alarms

Used to refresh local cleanup rules periodically.

### Host permissions for supported search engines

SearchWise needs access to supported search result pages so it can read result titles, links, and snippets, then hide low-quality results and highlight search keywords directly on the page.

Supported hosts:

- google.com
- google.com.hk
- bing.com
- cn.bing.com
- baidu.com
- duckduckgo.com
- sogou.com
- so.com
- yandex.com
- yandex.ru

## Reviewer Notes

SearchWise is a local-first extension. The current store build does not require a user account or backend service for its core functionality.

To test:

1. Install the extension.
2. Open a supported search engine.
3. Search for a technical query such as `laravel sanctum`.
4. The extension will highlight query keywords and hide results from built-in low-quality domains when matched.
5. Open the extension options page to add a custom blocked domain.

AI summaries and cloud sync are optional future cloud features and are not required for this initial local-first release.
