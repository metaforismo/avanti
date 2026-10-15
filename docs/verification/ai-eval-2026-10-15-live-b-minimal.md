# AI eval 2026-10-15

{
"status": "PASS",
"reason": null,
"mode": "live",
"cases": 74,
"requests": 99,
"ai": 72,
"servedModels": {
"openai/gpt-6-luna": 6,
"deepseek/deepseek-v4.1-flash": 66
},
"heuristic": 2,
"accuracy": 1,
"scoredCases": 58,
"practiceAccuracy": 1,
"translationSemanticAccuracy": "manual_review_required",
"translationAiCoverage": 1,
"extractionPrecision": 1,
"extractionRecall": 1,
"guardViolations": 0,
"languageFailures": 0,
"languageScriptPass": 23,
"languageUnverified": 51,
"jsonValidity": 1,
"textMedianLatencyMs": 2323.5,
"textP95LatencyMs": 9051,
"fallbackRate": 0.02702702702702703,
"meanLatencyMs": 3465.2432432432433,
"costEstimateEur": 0.03639373
}

Configuration: {"provider":"openrouter","models":{"fast":"openai/gpt-6-luna","reasoning":"openai/gpt-6-luna","vision":"openai/gpt-6-luna"},"dataPolicy":"strict","fallbacks":["deepseek/deepseek-v4.1-flash"],"reasoning":{"fast":"minimal","reasoning":"minimal","vision":"minimal"},"attemptTimeoutMs":{"fast":6000,"reasoning":15000,"vision":20000},"totalTimeoutMs":45000,"maxAttempts":3,"prices":{"deepseek/deepseek-v4.1-flash":[0.03,0.7],"openai/gpt-6-luna":[0.1,0.5]},"keyPresent":true,"monthlyBudgetEur":50}

- Synthetic fixtures only; no real citizen data
- Accuracy checks only labelled fields; translations need human semantic review
- Language checks prove script mismatches only; Latin languages are unverified
- Final JSON includes heuristic fallback; not raw model JSON validity
- Estimated EUR cost, not provider invoice
- No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts

Detailed rows in adjacent JSON. Runtime safety success does not establish model quality.
