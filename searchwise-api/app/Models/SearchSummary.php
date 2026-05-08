<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SearchSummary extends Model
{
    protected $fillable = [
        'query_hash',
        'query',
        'summary',
        'sources',
        'expires_at',
    ];

    protected $casts = [
        'sources' => 'array',
        'expires_at' => 'datetime',
    ];

    public static function getValid(string $query): ?self
    {
        $hash = md5(trim(mb_strtolower($query)));
        return self::where('query_hash', $hash)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            })
            ->first();
    }
}
