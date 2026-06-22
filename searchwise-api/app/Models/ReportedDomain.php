<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReportedDomain extends Model
{
    protected $fillable = [
        'domain',
        'report_count',
    ];
}
