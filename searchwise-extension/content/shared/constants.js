// SearchWise - Constants
const SW = {
    API_BASE: 'http://127.0.0.1:8899/api/v1',

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
        CHECKOUT: 'CHECKOUT',
        BILLING_PORTAL: 'BILLING_PORTAL',
    },

    // Storage keys
    STORAGE: {
        BLACKLIST: 'blacklist_domains',
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

    DEFAULT_BLACKLIST: [
        'pinterest.com',
        'pinterest.jp',
        'csdn.net',
        'zhuanlan.zhihu.com',
        'zhihu.com',
        'jianshu.com',
        'toutiao.com',
        'answers.com',
        'e-how.com',
        'wikihow.com',
        'buzzfeed.com',
        'quora.com',
        'iteye.com',
        'jb51.net',
        'php.cn',
        'educba.com',
        'tutorialspoint.com',
    ],

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
