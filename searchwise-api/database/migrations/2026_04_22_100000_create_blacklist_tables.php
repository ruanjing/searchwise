<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blacklist_domains', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('domain');
            $table->timestamps();

            $table->index(['user_id', 'domain']);
        });

        Schema::create('default_blacklists', function (Blueprint $table) {
            $table->id();
            $table->string('domain')->unique();
            $table->string('category')->nullable();
            $table->string('label')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('feature', ['ai_summary', 'domain_block']);
            $table->string('detail')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['user_id', 'feature', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_logs');
        Schema::dropIfExists('default_blacklists');
        Schema::dropIfExists('blacklist_domains');
    }
};
