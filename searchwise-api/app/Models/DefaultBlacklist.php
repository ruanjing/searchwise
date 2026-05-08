<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DefaultBlacklist extends Model
{
    protected $fillable = [
        'domain',
        'category',
        'label',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
