# AI stress

{
  "status": "BLOCKED",
  "mode": "live",
  "reason": "missing_provider_or_key",
  "concurrency": 3,
  "liveCases": 0,
  "requests": 0,
  "ai": 0,
  "heuristic": 0,
  "observed429": 0,
  "observedTimeout": 0,
  "wallMs": 0,
  "costEstimateEur": 0
}

## Deterministic fault injection

[
  {
    "fault": "429",
    "status": "PASS",
    "fallback": 12,
    "opened": true,
    "suppressedWhileOpen": true,
    "recovered": true,
    "closed": true,
    "networkCalls": 4
  },
  {
    "fault": "timeout",
    "status": "PASS",
    "fallback": 12,
    "opened": true,
    "suppressedWhileOpen": true,
    "recovered": true,
    "closed": true,
    "networkCalls": 5
  }
]

- 429/timeout breaker lifecycle scenarios inject faults locally; they are not provider observations
- Observed429/Timeout counts final fallback reasons; intermediate retries may recover
- No live network without AI_LIVE=1; limit <=100 cases, attempts bounded by AI_MAX_ATTEMPTS

