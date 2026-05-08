<?php

namespace App\Services;

use App\Models\UsageLog;
use App\Models\User;

class UsageTrackingService
{
    public function canUseFeature(User $user, string $feature): bool
    {
        if ($user->isPro()) {
            return true;
        }

        $limits = config('searchwise.limits.free');
        $maxLimit = $limits[$feature] ?? 0;

        if ($feature === 'domain_block') {
            // Domain block is a total count, not daily
            return $user->blacklistDomains()->count() < $maxLimit;
        }

        // Daily limits
        $todayCount = UsageLog::where('user_id', $user->id)
            ->where('feature', $feature)
            ->whereDate('created_at', now()->toDateString())
            ->count();

        return $todayCount < $maxLimit;
    }

    public function recordUsage(User $user, string $feature, ?string $detail = null): UsageLog
    {
        return UsageLog::create([
            'user_id' => $user->id,
            'feature' => $feature,
            'detail' => $detail,
            'created_at' => now(),
        ]);
    }

    public function getTodayUsage(User $user): array
    {
        $logs = UsageLog::where('user_id', $user->id)
            ->whereDate('created_at', now()->toDateString())
            ->get()
            ->groupBy('feature');

        return [
            'ai_summary' => ($logs->get('ai_summary') ?? collect())->count(),
            'domain_block' => ($logs->get('domain_block') ?? collect())->count(),
        ];
    }
}
