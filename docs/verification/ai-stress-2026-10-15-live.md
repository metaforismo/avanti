# AI stress

{
"status": "PASS",
"mode": "live",
"reason": null,
"concurrency": 8,
"cases": 40,
"liveCases": 40,
"requests": 41,
"ai": 40,
"heuristic": 0,
"observed429": 0,
"observedTimeout": 0,
"medianLatencyMs": 1064.5,
"p95LatencyMs": 1664,
"fallbackRate": 0,
"guardViolations": 0,
"languageFailures": 0,
"wallMs": 12507,
"costEstimateEur": 0.0035526699999999995
}

## Deterministic fault injection

[
{
"fault": "429",
"status": "PASS",
"fallback": 40,
"opened": true,
"suppressedWhileOpen": true,
"recovered": true,
"closed": true,
"transportCalls": 9
},
{
"fault": "timeout",
"status": "PASS",
"fallback": 40,
"opened": true,
"suppressedWhileOpen": true,
"recovered": true,
"closed": true,
"transportCalls": 10
}
]

- 429/timeout breaker lifecycle scenarios inject faults locally; they are not provider observations
- Observed429/Timeout counts final fallback reasons; intermediate retries may recover
- No live network without AI_LIVE=1; limit <=100 cases, attempts bounded by AI_MAX_ATTEMPTS
