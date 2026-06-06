import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const SW = {
  ENGINE: {
    GOOGLE: 'google',
    BING: 'bing',
    BAIDU: 'baidu',
    DUCKDUCKGO: 'duckduckgo',
    SOGOU: 'sogou',
    SO360: 'so360',
    YANDEX: 'yandex',
  },
};

class FakeElement {
  constructor({ text = '', href = '', value = '', attrs = {}, children = {} } = {}) {
    this.textContent = text;
    this.href = href;
    this.value = value;
    this.attrs = attrs;
    this.children = children;
    this.style = {};
    this.dataset = {};
  }

  querySelector(selector) {
    const parts = selector.split(',').map(s => s.trim());
    for (const part of parts) {
      if (this.children[part]) return this.children[part];
    }
    return this.children[selector] || null;
  }

  getAttribute(name) {
    return this.attrs[name] || null;
  }
}

function loadAdapter(file, exportName, document, url) {
  const code = fs.readFileSync(path.join(root, file), 'utf8');
  const context = {
    SW,
    URL,
    URLSearchParams,
    document,
    window: {
      location: new URL(url),
    },
  };

  vm.createContext(context);
  vm.runInContext(`${code}\nthis.__adapter = ${exportName};`, context);
  return context.__adapter;
}

function makeDocument({ inputValue, containers, rightColumn = true }) {
  return {
    querySelector(selector) {
      if (selector.includes('input') || selector.includes('#kw') || selector.includes('#query') || selector.includes('#input')) {
        return new FakeElement({ value: inputValue, attrs: { value: inputValue }, text: inputValue, children: {}, href: '' ,});
      }
      if (selector.includes('right') || selector.includes('rhs') || selector.includes('b_context') || selector.includes('side') || selector.includes('aside')) {
        return rightColumn ? new FakeElement() : null;
      }
      if (selector.includes('content_left') || selector.includes('#rso') || selector.includes('b_results') || selector.includes('main') || selector.includes('react-layout') || selector.includes('serp')) {
        return new FakeElement();
      }
      return null;
    },
    querySelectorAll() {
      return containers;
    },
  };
}

function link(href, attrs = {}) {
  return new FakeElement({ href, attrs, text: href });
}

function node(text) {
  return new FakeElement({ text });
}

function testGoogle() {
  const container = new FakeElement({
    children: {
      'a[href]': link('https://laravel.com/docs/sanctum'),
      h3: node('Laravel Sanctum - Laravel Docs'),
      '[data-sncf], .VwiC3b, .IsZvec': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/google.js', 'GoogleAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://www.google.com/search?q=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].url, 'https://laravel.com/docs/sanctum');
}

function testBing() {
  const container = new FakeElement({
    children: {
      'h2 a[href]': link('https://laravel.com/docs/sanctum'),
      h2: node('Laravel Sanctum - Laravel Docs'),
      '.b_caption p, .b_lineclamp2': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/bing.js', 'BingAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://www.bing.com/search?q=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].title, 'Laravel Sanctum - Laravel Docs');
}

function testBaidu() {
  const container = new FakeElement({
    attrs: { mu: 'https://laravel.com/docs/sanctum' },
    text: 'Laravel Sanctum provides token authentication.',
    children: {
      'h3 a[href], .c-title a[href], a[href][mu], a[href*="baidu.com/link?"]': link('https://www.baidu.com/link?url=abc', { mu: 'https://laravel.com/docs/sanctum' }),
      'h3, .c-title': node('Laravel Sanctum - Laravel Docs'),
      '.c-abstract, .content-right_8Zs40, .c-span-last .c-color-text, .c-span-last, .c-color-text, .content_1YWBm, .op_exactqa_s_answer': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/baidu.js', 'BaiduAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://www.baidu.com/s?wd=laravel%20sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].url, 'https://laravel.com/docs/sanctum');
}

function testDuckDuckGo() {
  const container = new FakeElement({
    children: {
      'a[data-testid="result-title-a"], h2 a[href], .result__title a[href], a[href]': link('https://laravel.com/docs/sanctum'),
      'h2, [data-testid="result-title-a"], .result__title': node('Laravel Sanctum - Laravel Docs'),
      '[data-result="snippet"], [data-testid="result-snippet"], .result__snippet': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/duckduckgo.js', 'DuckDuckGoAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
    rightColumn: false,
  }), 'https://duckduckgo.com/?q=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].url, 'https://laravel.com/docs/sanctum');
}

function testSogou() {
  const container = new FakeElement({
    children: {
      'h3 a[href], .vr-title a[href], .pt a[href], a[href]': link('https://laravel.com/docs/sanctum'),
      'h3, .vr-title, .pt': node('Laravel Sanctum - Laravel Docs'),
      '.str_info, .ft, .text-layout, .fz-mid, .star-wiki-abstract': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/sogou.js', 'SogouAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://www.sogou.com/web?query=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].title, 'Laravel Sanctum - Laravel Docs');
}

function testSo360() {
  const container = new FakeElement({
    children: {
      'h3 a[href], .res-title a[href], a[href]': link('https://laravel.com/docs/sanctum'),
      'h3, .res-title': node('Laravel Sanctum - Laravel Docs'),
      '.res-desc, .res-rich, .summary, .content': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/so360.js', 'So360Adapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://www.so.com/s?q=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].url, 'https://laravel.com/docs/sanctum');
}

function testYandex() {
  const container = new FakeElement({
    children: {
      '.OrganicTitle-Link[href], h2 a[href], a.Link[href]': link('https://laravel.com/docs/sanctum'),
      '.OrganicTitle, h2, .organic__url-text': node('Laravel Sanctum - Laravel Docs'),
      '.OrganicTextContentSpan, .TextContainer, .organic__text': node('Laravel Sanctum provides token authentication.'),
    },
  });
  const adapter = loadAdapter('content/engines/yandex.js', 'YandexAdapter', makeDocument({
    inputValue: 'laravel sanctum',
    containers: [container],
  }), 'https://yandex.com/search/?text=laravel+sanctum');

  assert.equal(adapter.getSearchQuery(), 'laravel sanctum');
  assert.equal(adapter.getResults().length, 1);
  assert.equal(adapter.getResults()[0].title, 'Laravel Sanctum - Laravel Docs');
}

testGoogle();
testBing();
testBaidu();
testDuckDuckGo();
testSogou();
testSo360();
testYandex();

console.log('engine adapter smoke tests passed');
