<?php

return [
    'limits' => [
        'free' => [
            'ai_summary' => 3,
            'domain_block' => 5,
        ],
    ],

    'stripe_prices' => [
        'monthly' => env('STRIPE_MONTHLY_PRICE_ID'),
        'yearly' => env('STRIPE_YEARLY_PRICE_ID'),
    ],

    'cache' => [
        'blacklist_ttl' => 3600,
    ],
];
