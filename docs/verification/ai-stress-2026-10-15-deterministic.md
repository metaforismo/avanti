# AI stress

{
"status": "PASS",
"mode": "deterministic",
"reason": null,
"concurrency": 4,
"cases": 40,
"liveCases": 0,
"requests": 0,
"ai": 0,
"heuristic": 0,
"observed429": 0,
"observedTimeout": 0,
"wallMs": 119,
"costEstimateEur": 0
}

## Deterministic fault injection

[
{
"fault": "429",
"status": "PASS",
"fallback": 20,
"opened": true,
"suppressedWhileOpen": true,
"recovered": true,
"closed": true,
"transportCalls": 5
},
{
"fault": "timeout",
"status": "PASS",
"fallback": 20,
"opened": true,
"suppressedWhileOpen": true,
"recovered": true,
"closed": true,
"transportCalls": 6
}
]

- 429/timeout breaker lifecycle scenarios inject faults locally; they are not provider observations
- Observed429/Timeout counts final fallback reasons; intermediate retries may recover
- No live network without AI_LIVE=1; limit <=100 cases, attempts bounded by AI_MAX_ATTEMPTS
