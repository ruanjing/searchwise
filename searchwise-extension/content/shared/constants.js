// SearchWise - Constants
const SW = {
    API_BASE: null,

    // Message types for chrome.runtime.sendMessage
    MSG: {
        FETCH_BLACKLIST: 'FETCH_BLACKLIST',
        AI_SUMMARY: 'AI_SUMMARY',
        GET_USAGE: 'GET_USAGE',
        LOGIN: 'LOGIN',
        REGISTER: 'REGISTER',
        LOGOUT: 'LOGOUT',
        BLOCKED_COUNT: 'BLOCKED_COUNT',
        GET_USER: 'GET_USER',
        ADD_DOMAIN: 'ADD_DOMAIN',
        REMOVE_DOMAIN: 'REMOVE_DOMAIN',
        ADD_ALLOWED_DOMAIN: 'ADD_ALLOWED_DOMAIN',
        REMOVE_ALLOWED_DOMAIN: 'REMOVE_ALLOWED_DOMAIN',
        CHECKOUT: 'CHECKOUT',
        BILLING_PORTAL: 'BILLING_PORTAL',
    },

    // Storage keys
    STORAGE: {
        BLACKLIST: 'blacklist_domains',
        CUSTOM_BLACKLIST: 'custom_blacklist_domains',
        ALLOWLIST: 'allowed_domains',
        AUTH_TOKEN: 'auth_token',
        USER_INFO: 'user_info',
        SETTINGS: 'sw_settings',
        LANGUAGE: 'language',
    },

    // Plans
    PLAN: {
        FREE: 'free',
        PRO: 'pro',
    },

    // Free tier limits
    LIMITS: {
        FREE_DOMAINS: 5,
        LOCAL_FREE_DOMAINS: 20,
        FREE_AI_SUMMARIES_PER_DAY: 3,
    },

    DEFAULT_RULES: [
        { domain: 'pinterest.com', category: 'content_farm' },
        { domain: 'pinterest.jp', category: 'content_farm' },
        { domain: 'csdn.net', category: 'cn_mirror' },
        { domain: 'zhuanlan.zhihu.com', category: 'cn_mirror' },
        { domain: 'zhihu.com', category: 'cn_mirror' },
        { domain: 'jianshu.com', category: 'cn_mirror' },
        { domain: 'toutiao.com', category: 'content_farm' },
        { domain: 'answers.com', category: 'content_farm' },
        { domain: 'e-how.com', category: 'content_farm' },
        { domain: 'wikihow.com', category: 'content_farm' },
        { domain: 'buzzfeed.com', category: 'content_farm' },
        { domain: 'quora.com', category: 'qa_noise' },
        { domain: 'iteye.com', category: 'cn_mirror' },
        { domain: 'jb51.net', category: 'cn_mirror' },
        { domain: 'php.cn', category: 'cn_mirror' },
        { domain: 'educba.com', category: 'low_signal_tutorial' },
        { domain: 'tutorialspoint.com', category: 'low_signal_tutorial' },
        { domain: 'javatpoint.com', category: 'low_signal_tutorial' },
        { domain: 'guru99.com', category: 'low_signal_tutorial' },
        { domain: 'w3resource.com', category: 'low_signal_tutorial' },
        { domain: 'includehelp.com', category: 'low_signal_tutorial' },
        { domain: 'brainly.com', category: 'qa_noise' },
    ],

    DEFAULT_BLACKLIST: [],

    // UI
    SIDEBAR_WIDTH: 380,

    // Engine identifiers
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

SW.DEFAULT_BLACKLIST = SW.DEFAULT_RULES.map(rule => rule.domain);
