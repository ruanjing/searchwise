# SearchWise Edge Add-ons Submission Checklist

## Upload Package

- Package: `release/searchwise-edge-1.5.7.zip`
- Manifest version: 3
- Extension version: 1.5.7
- Package root contains `manifest.json`: yes

## Store Assets

- Logo: `searchwise-extension/assets/icons/icon128.png`
- Screenshot: `release/store-assets/screenshot-en-1280x800.png`
- Screenshot zh-CN: `release/store-assets/screenshot-zh-1280x800.png`
- Small promotional tile: `release/store-assets/promo-small-440x280.png`
- Large promotional tile: `release/store-assets/promo-large-1400x560.png`

## Properties

- Category: Productivity
- Alternative category: Developer Tools
- Website: https://searchwise-6na.pages.dev
- Support contact: ruanjing40783008@126.com
- Privacy policy: https://searchwise-6na.pages.dev/privacy.html
- Mature content: No
- Visibility: Public
- Markets: All markets

## English Listing

### Name

SearchWise

### Short Description

Clean search results by hiding low-quality content farms and highlighting useful technical sources.

### Detailed Description

SearchWise is a local-first browser extension that helps make search result pages easier to scan.

It runs on supported search engines and hides low-quality content farms, repeated mirrors, and noisy results while keeping useful sources easier to find. It also highlights search keywords in result titles and snippets, so technical searches are faster to review.

Core features:

- Hide low-quality search results with built-in cleanup rules.
- See why a hidden result matched a rule when you reveal hidden results.
- Add your own blocked domains locally.
- Allow sites again when a cleanup rule is too aggressive.
- Block unwanted sites directly from search result pages and undo mistakes.
- Highlight search keywords inside result titles and snippets.
- Works on Google, Bing, Baidu, DuckDuckGo, Sogou, 360 Search, and Yandex result pages.
- Use the extension without creating an account.
- Keep the free version local-first and lightweight.

SearchWise does not sell user data, does not inject third-party ads into search results, and does not track users across websites.

## Chinese Listing

### Name

SearchWise

### Short Description

净化搜索结果，屏蔽低质量内容农场，并高亮有用的技术资料来源。

### Detailed Description

SearchWise 是一个本地优先的浏览器扩展，用来让搜索结果页面更容易浏览。

它会在支持的搜索引擎结果页中运行，隐藏低质量内容农场、重复搬运站、镜像站和噪音结果，同时高亮搜索关键词，帮助你更快找到有价值的信息。

核心功能：

- 使用内置规则隐藏低质量搜索结果。
- 显示隐藏结果时，可以查看命中的规则原因。
- 在本地添加自定义屏蔽域名。
- 规则误伤时，可以把网站加入允许列表。
- 在搜索结果页一键屏蔽不想再看到的网站，并支持撤销。
- 高亮搜索结果标题和摘要中的关键词。
- 支持 Google、Bing、百度、DuckDuckGo、搜狗、360 搜索和 Yandex。
- 免费版无需创建账号即可使用。
- 免费版本地优先、轻量运行。

SearchWise 不销售用户数据，不会在搜索结果中注入第三方广告，也不会跨网站追踪用户。

## Single Purpose Description

SearchWise cleans supported search result pages by hiding low-quality domains and highlighting search keywords, with user-controlled local block and allow rules.

## Permission Justification

### storage

Stores user settings, local cleanup rules, language preference, custom blocked domains, allowed domains, and optional account state.

### alarms

Refreshes the local cleanup rule cache periodically.

### Host permissions

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

## Remote Code Declaration

No. This Manifest V3 build does not load or execute remotely hosted code.

## Certification Notes

SearchWise is a local-first extension. The current store build does not require a user account or backend service for its core functionality.

To test the primary function:

1. Install the extension.
2. Click the SearchWise toolbar icon.
3. Click `Try on Bing`. This opens a supported Bing search results page for `javascript tutorial javatpoint guru99`.
4. On the Bing results page, SearchWise highlights query keywords. If results from built-in low-signal tutorial domains such as `javatpoint.com` or `guru99.com` appear, SearchWise hides or tags them according to the selected filter mode.
5. Open the extension options page to review built-in cleanup rules or add a custom blocked domain.
6. Optional manual test: search any supported engine, then use the SearchWise controls on a result to block a site or show hidden results.

AI summaries and cloud sync are optional future cloud features and are not required for this initial local-first release.
