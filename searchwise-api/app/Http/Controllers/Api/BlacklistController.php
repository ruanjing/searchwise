<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BlacklistDomain;
use App\Models\DefaultBlacklist;
use App\Services\UsageTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlacklistController extends Controller
{
    protected $usageService;

    public function __construct(UsageTrackingService $usageService)
    {
        $this->usageService = $usageService;
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $userDomains = $user->blacklistDomains()->get(['id', 'domain']);
        $defaultDomains = DefaultBlacklist::active()->get(['domain', 'category', 'label']);

        $allDomains = collect($userDomains->pluck('domain'))
            ->merge($defaultDomains->pluck('domain'))
            ->unique()
            ->values()
            ->toArray();

        return response()->json([
            'user_domains' => $userDomains,
            'default_domains' => $defaultDomains,
            'all_domains' => $allDomains,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $user = $request->user();
        $domain = $this->normalizeDomain($request->domain);

        // Check if already exists
        if ($user->blacklistDomains()->where('domain', $domain)->exists()) {
            return response()->json(['error' => 'Domain already in blacklist'], 409);
        }

        // Check if in defaults (no need to add again)
        if (DefaultBlacklist::active()->where('domain', $domain)->exists()) {
            return response()->json(['error' => 'Domain already blocked by default'], 409);
        }

        // Check usage limit for free users
        if (!$this->usageService->canUseFeature($user, 'domain_block')) {
            return response()->json([
                'error' => 'Domain limit reached. Upgrade to Pro for unlimited domains.',
            ], 429);
        }

        $blacklistDomain = $user->blacklistDomains()->create([
            'domain' => $domain,
        ]);

        $this->usageService->recordUsage($user, 'domain_block', $domain);

        return response()->json($blacklistDomain, 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $domain = $request->user()->blacklistDomains()->findOrFail($id);
        $domain->delete();

        return response()->json(['message' => 'Domain removed']);
    }

    public function defaults(): JsonResponse
    {
        return response()->json(
            DefaultBlacklist::active()->get(['domain', 'category', 'label'])
        );
    }

    public function report(Request $request): JsonResponse
    {
        $request->validate([
            'domain' => 'required|string|max:255',
        ]);

        $domain = $this->normalizeDomain($request->domain);
        if (empty($domain)) {
            return response()->json(['error' => 'Invalid domain'], 400);
        }

        $reported = \App\Models\ReportedDomain::firstOrCreate(
            ['domain' => $domain],
            ['report_count' => 0]
        );
        $reported->increment('report_count');

        return response()->json([
            'success' => true,
            'domain' => $domain,
            'report_count' => $reported->report_count,
        ], 200);
    }

    private function normalizeDomain(string $domain): string
    {
        $domain = strtolower(trim($domain));
        $domain = preg_replace('#^https?://#', '', $domain);
        $domain = preg_replace('#^www\.#', '', $domain);
        $domain = preg_replace('#/.*$#', '', $domain);

        return $domain;
    }
}
