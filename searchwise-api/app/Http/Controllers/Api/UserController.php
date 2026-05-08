<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\UsageTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function __construct(
        private UsageTrackingService $usageService
    ) {}

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'plan' => $user->plan,
            'blacklist_count' => $user->blacklistDomains()->count(),
            'usage_today' => $this->usageService->getTodayUsage($user),
            'limits' => $user->getLimits(),
        ]);
    }

    public function usage(Request $request): JsonResponse
    {
        return response()->json(
            $this->usageService->getTodayUsage($request->user())
        );
    }
}
