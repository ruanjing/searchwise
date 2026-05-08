<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function checkout(Request $request): JsonResponse
    {
        $request->validate([
            'plan' => 'required|in:monthly,yearly',
            'success_url' => 'sometimes|url',
            'cancel_url' => 'sometimes|url',
        ]);

        $user = $request->user();

        $priceId = $request->plan === 'yearly'
            ? config('searchwise.stripe_prices.yearly')
            : config('searchwise.stripe_prices.monthly');

        if (!$priceId) {
            return response()->json(['error' => 'Subscription not configured'], 500);
        }

        $successUrl = $request->success_url ?? config('app.url') . '/subscription/success';
        $cancelUrl = $request->cancel_url ?? config('app.url') . '/subscription/cancel';

        $checkout = $user->newSubscription('default', $priceId)
            ->checkout([
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
            ]);

        return response()->json([
            'checkout_url' => $checkout->url,
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'plan' => $user->plan,
            'is_pro' => $user->isPro(),
            'subscribed' => $user->subscribed('default'),
            'on_trial' => $user->onTrial('default'),
            'ends_at' => $user->subscription('default')?->ends_at,
        ]);
    }

    public function cancel(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->subscribed('default')) {
            return response()->json(['error' => 'No active subscription'], 404);
        }

        $user->subscription('default')->cancel();

        return response()->json(['message' => 'Subscription cancelled']);
    }

    public function resume(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->subscription('default')?->onGracePeriod()) {
            return response()->json(['error' => 'No cancelled subscription to resume'], 404);
        }

        $user->subscription('default')->resume();

        return response()->json(['message' => 'Subscription resumed']);
    }

    public function portal(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasStripeId()) {
            return response()->json(['error' => 'No Stripe account'], 404);
        }

        $url = $user->billingPortalUrl(config('app.url'));

        return response()->json(['portal_url' => $url]);
    }
}
