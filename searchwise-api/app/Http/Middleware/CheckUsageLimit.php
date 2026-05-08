<?php

namespace App\Http\Middleware;

use App\Services\UsageTrackingService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUsageLimit
{
    public function __construct(
        private UsageTrackingService $usageService
    ) {}

    public function handle(Request $request, Closure $next, string $feature): Response
    {
        if (!$this->usageService->canUseFeature($request->user(), $feature)) {
            return response()->json([
                'error' => 'Usage limit exceeded',
                'feature' => $feature,
                'upgrade_url' => '/api/v1/subscription/checkout',
            ], 429);
        }

        return $next($request);
    }
}
