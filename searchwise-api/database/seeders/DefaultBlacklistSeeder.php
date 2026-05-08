<?php

namespace Database\Seeders;

use App\Models\DefaultBlacklist;
use Illuminate\Database\Seeder;

class DefaultBlacklistSeeder extends Seeder
{
    public function run(): void
    {
        $domains = [
            ['domain' => 'pinterest.com', 'category' => 'aggregator', 'label' => 'Pinterest'],
            ['domain' => 'pinterest.jp', 'category' => 'aggregator', 'label' => 'Pinterest JP'],
            ['domain' => 'csdn.net', 'category' => 'aggregator', 'label' => 'CSDN'],
            ['domain' => 'zhuanlan.zhihu.com', 'category' => 'paywall', 'label' => 'Zhihu Column'],
            ['domain' => 'zhihu.com', 'category' => 'paywall', 'label' => 'Zhihu'],
            ['domain' => 'jianshu.com', 'category' => 'content_farm', 'label' => 'Jianshu'],
            ['domain' => 'toutiao.com', 'category' => 'content_farm', 'label' => 'Toutiao'],
            ['domain' => 'answers.com', 'category' => 'content_farm', 'label' => 'Answers.com'],
            ['domain' => 'e-how.com', 'category' => 'content_farm', 'label' => 'eHow'],
            ['domain' => 'wikihow.com', 'category' => 'content_farm', 'label' => 'wikiHow'],
            ['domain' => 'buzzfeed.com', 'category' => 'content_farm', 'label' => 'BuzzFeed'],
            ['domain' => 'quora.com', 'category' => 'aggregator', 'label' => 'Quora'],
            ['domain' => 'medium.com', 'category' => 'paywall', 'label' => 'Medium'],
            ['domain' => 'slideshare.net', 'category' => 'aggregator', 'label' => 'SlideShare'],
            ['domain' => 'iteye.com', 'category' => 'dev_mirror', 'label' => 'ITeye'],
            ['domain' => 'jb51.net', 'category' => 'dev_content_farm', 'label' => 'JB51'],
            ['domain' => 'php.cn', 'category' => 'dev_content_farm', 'label' => 'PHP.cn'],
            ['domain' => 'educba.com', 'category' => 'dev_content_farm', 'label' => 'EDUCBA'],
            ['domain' => 'tutorialspoint.com', 'category' => 'dev_content_farm', 'label' => 'TutorialsPoint'],
        ];

        foreach ($domains as $data) {
            DefaultBlacklist::updateOrCreate(
                ['domain' => $data['domain']],
                $data + ['is_active' => true]
            );
        }
    }
}
