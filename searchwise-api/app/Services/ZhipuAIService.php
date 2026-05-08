<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ZhipuAIService
{
    private string $apiKey;
    private string $baseUrl = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
    private string $model;

    public function __construct()
    {
        $this->apiKey = config('services.zhipu.api_key');
        $this->model = config('services.zhipu.model', 'glm-4-plus');
    }

    public function summarizeSearchResults(string $query, array $results): string
    {
        $prompt = $this->buildPrompt($query, $results);

        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->withOptions([
                'verify' => $this->shouldVerifySsl(),
                'timeout' => 30,
            ])->post($this->baseUrl, [
                'model' => $this->model,
                'messages' => [
                    ['role' => 'system', 'content' => $this->getSystemPrompt()],
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.5,
                'max_tokens' => 1000,
                'stream' => false,
            ]);

            if ($response->failed()) {
                Log::error('ZhipuAI API error', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                return 'Unable to generate summary at this time.';
            }

            return $response->json('choices.0.message.content', 'No summary available.');
        } catch (\Exception $e) {
            Log::error('ZhipuAI API exception', ['error' => $e->getMessage()]);
            return 'Unable to generate summary at this time.';
        }
    }

    /**
     * @return \Generator
     */
    public function summarizeSearchResultsStream(string $query, array $results)
    {
        $prompt = $this->buildPrompt($query, $results);
        $client = new \GuzzleHttp\Client([
            'verify' => $this->shouldVerifySsl(),
            'timeout' => 60,
        ]);

        try {
            $response = $client->post($this->baseUrl, [
                'headers' => [
                    'Authorization' => 'Bearer ' . $this->apiKey,
                    'Content-Type' => 'application/json',
                    'Accept' => 'text/event-stream',
                ],
                'json' => [
                    'model' => $this->model,
                    'messages' => [
                        ['role' => 'system', 'content' => $this->getSystemPrompt()],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'temperature' => 0.5,
                    'max_tokens' => 1000,
                    'stream' => true,
                ],
                'stream' => true,
            ]);

            $body = $response->getBody();
            $buffer = '';

            while (!$body->eof()) {
                $chunk = $body->read(1024);
                $buffer .= $chunk;

                while (($pos = strpos($buffer, "\n")) !== false) {
                    $line = substr($buffer, 0, $pos);
                    $buffer = substr($buffer, $pos + 1);

                    if (str_starts_with($line, 'data: ')) {
                        $data = substr($line, 6);
                        if ($data === '[DONE]') {
                            return;
                        }

                        $json = json_decode($data, true);
                        $content = $json['choices'][0]['delta']['content'] ?? '';
                        if ($content) {
                            yield $content;
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::error('ZhipuAI streaming exception', ['error' => $e->getMessage()]);
            yield 'Unable to generate summary at this time. Please check the AI service configuration and try again.';
        }
    }

    private function shouldVerifySsl(): bool
    {
        return filter_var(config('services.zhipu.verify_ssl', true), FILTER_VALIDATE_BOOL);
    }

    private function buildPrompt(string $query, array $results): string
    {
        $resultsText = collect($results)->take(3)->map(function ($r, $i) {
            return ($i + 1) . ". Title: {$r['title']}\n   URL: {$r['url']}\n   Snippet: {$r['snippet']}";
        })->join("\n\n");

        return "Search query: \"{$query}\"\n\nTop visible results:\n{$resultsText}\n\n"
             . "Create a concise trusted-search brief from these results only. "
             . "Include: 1) the direct answer or main takeaways, 2) where sources agree or differ, "
             . "3) any uncertainty, stale information, commercial bias, paywall, or low-source-quality warning you can infer from title/snippet/URL, "
             . "and 4) which source looks most useful to open next. "
             . "Do not invent facts that are not supported by the provided result snippets. "
             . "Respond in the same language as the query.";
    }

    private function getSystemPrompt(): string
    {
        return "You are SearchWise, a developer-search cleanup assistant. Your job is to help programmers decide "
             . "which technical search results are worth opening. Summarize only the provided result snippets, "
             . "separate supported takeaways from uncertainty, call out weak, outdated, mirrored, or commercial sources when visible, "
             . "and prefer official docs, source repositories, issue trackers, and high-signal technical communities. "
             . "Format with short markdown headings and bullets. Always respond in the same language as the user's query.";
    }
}
