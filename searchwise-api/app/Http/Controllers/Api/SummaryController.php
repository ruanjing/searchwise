<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\UsageTrackingService;
use App\Services\ZhipuAIService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SummaryController extends Controller
{
    public function __construct(
        private ZhipuAIService $aiService,
        private UsageTrackingService $usageService
    ) {}

    public function generate(Request $request)
    {
        $request->validate([
            'query' => 'required|string|max:500',
            'results' => 'required|array|min:1|max:3',
            'results.*.title' => 'required|string',
            'results.*.url' => 'required|url',
            'results.*.snippet' => 'nullable|string',
            'stream' => 'nullable|boolean',
        ]);

        $query = $request->input('query');
        $user = $request->user();

        // 1. Check Cache first
        $cached = \App\Models\SearchSummary::getValid($query);
        if ($cached) {
            $data = [
                'summary' => $cached->summary,
                'sources' => $cached->sources,
                'cached' => true,
                'usage' => [
                    'used_today' => $this->usageService->getTodayUsage($user)['ai_summary'],
                    'daily_limit' => $user->getLimits()['max_ai_summaries_per_day'],
                ],
            ];

            if ($request->boolean('stream')) {
                return $this->streamCachedSummary($data);
            }

            return response()->json([
                ...$data,
            ]);
        }

        // 2. Check usage limit (only if not cached)
        if (!$this->usageService->canUseFeature($user, 'ai_summary')) {
            return response()->json([
                'error' => 'Daily AI summary limit reached. Upgrade to Pro for unlimited summaries.',
                'upgrade_url' => '/api/v1/subscription/checkout',
            ], 429);
        }

        // 3. Handle Streaming or Standard Response
        if ($request->boolean('stream')) {
            return $this->handleStreamingResponse($user, $query, $request->results);
        }

        // Standard JSON response
        $summary = $this->aiService->summarizeSearchResults($query, $request->results);
        
        // Record usage
        $this->usageService->recordUsage($user, 'ai_summary', $query);

        // Save to cache
        \App\Models\SearchSummary::create([
            'query_hash' => md5(trim(mb_strtolower($query))),
            'query' => $query,
            'summary' => $summary,
            'sources' => collect($request->results)->map(fn ($r) => [
                'title' => $r['title'],
                'url' => $r['url'],
            ])->toArray(),
            'expires_at' => now()->addHours(24),
        ]);

        return response()->json([
            'summary' => $summary,
            'sources' => $request->results,
            'cached' => false,
            'usage' => [
                'used_today' => $this->usageService->getTodayUsage($user)['ai_summary'],
                'daily_limit' => $user->getLimits()['max_ai_summaries_per_day'],
            ],
        ]);
    }

    private function handleStreamingResponse($user, $query, $results)
    {
        return response()->stream(function () use ($user, $query, $results) {
            $fullSummary = '';
            
            // Send metadata first
            echo "data: " . json_encode(['type' => 'meta', 'status' => 'starting']) . "\n\n";
            if (ob_get_level() > 0) ob_flush();
            flush();

            foreach ($this->aiService->summarizeSearchResultsStream($query, $results) as $chunk) {
                $fullSummary .= $chunk;
                echo "data: " . json_encode(['type' => 'chunk', 'content' => $chunk]) . "\n\n";
                if (ob_get_level() > 0) ob_flush();
                flush();
            }

            // Record usage
            $this->usageService->recordUsage($user, 'ai_summary', $query);

            // Save to cache
            \App\Models\SearchSummary::create([
                'query_hash' => md5(trim(mb_strtolower($query))),
                'query' => $query,
                'summary' => $fullSummary,
                'sources' => collect($results)->map(fn ($r) => [
                    'title' => $r['title'],
                    'url' => $r['url'],
                ])->toArray(),
                'expires_at' => now()->addHours(24),
            ]);

            echo "data: " . json_encode(['type' => 'done']) . "\n\n";
            if (ob_get_level() > 0) ob_flush();
            flush();
        }, 200, [
            'Cache-Control' => 'no-cache',
            'Content-Type' => 'text/event-stream',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no', // For Nginx
        ]);
    }

    private function streamCachedSummary(array $data)
    {
        return response()->stream(function () use ($data) {
            echo "data: " . json_encode(['type' => 'meta', 'status' => 'cached']) . "\n\n";
            echo "data: " . json_encode(['type' => 'chunk', 'content' => $data['summary']]) . "\n\n";
            echo "data: " . json_encode(['type' => 'done', 'cached' => true, 'usage' => $data['usage'], 'sources' => $data['sources']]) . "\n\n";

            if (ob_get_level() > 0) ob_flush();
            flush();
        }, 200, [
            'Cache-Control' => 'no-cache',
            'Content-Type' => 'text/event-stream',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
