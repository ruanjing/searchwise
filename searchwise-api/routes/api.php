<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BlacklistController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\SummaryController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Public auth routes
    Route::post('auth/register', [AuthController::class, 'register']);
    Route::post('auth/login', [AuthController::class, 'login']);

    // Stripe webhook (no auth — uses signature verification)
    Route::post('webhooks/stripe', function () {
        // Cashier handles this automatically via its webhook controller
        return response()->json(['received' => true]);
    });

    // Public blacklist defaults (no auth needed)
    Route::get('blacklist/defaults', [BlacklistController::class, 'defaults']);

    // Authenticated routes
    Route::middleware('auth:sanctum')->group(function () {

        // Auth
        Route::post('auth/logout', [AuthController::class, 'logout']);

        // User
        Route::get('user', [UserController::class, 'show']);
        Route::get('user/usage', [UserController::class, 'usage']);

        // Blacklist
        Route::get('blacklist', [BlacklistController::class, 'index']);
        Route::post('blacklist', [BlacklistController::class, 'store']);
        Route::delete('blacklist/{id}', [BlacklistController::class, 'destroy']);

        // AI Summary
        Route::post('summary', [SummaryController::class, 'generate']);

        // Subscription
        Route::post('subscription/checkout', [SubscriptionController::class, 'checkout']);
        Route::get('subscription/status', [SubscriptionController::class, 'status']);
        Route::post('subscription/cancel', [SubscriptionController::class, 'cancel']);
        Route::post('subscription/resume', [SubscriptionController::class, 'resume']);
        Route::get('subscription/portal', [SubscriptionController::class, 'portal']);
    });
});
