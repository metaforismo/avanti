# AI eval 2026-10-15

{
"status": "PASS",
"reason": null,
"mode": "live",
"cases": 74,
"requests": 74,
"ai": 74,
"servedModels": {
"google/gemini-3.1-flash-lite": 72,
"openai/gpt-6-luna": 2
},
"heuristic": 0,
"accuracy": 1,
"scoredCases": 58,
"practiceAccuracy": 1,
"translationSemanticAccuracy": "manual_review_required",
"translationAiCoverage": 1,
"extractionPrecision": 1,
"extractionRecall": 1,
"guardViolations": 0,
"languageFailures": 0,
"languageScriptPass": 24,
"languageUnverified": 50,
"jsonValidity": 1,
"textMedianLatencyMs": 1760.5,
"textP95LatencyMs": 3283,
"fallbackRate": 0,
"meanLatencyMs": 2023.8243243243244,
"costEstimateEur": 0.05380590000000002
}

Configuration: {"provider":"openrouter","models":{"fast":"google/gemini-3.1-flash-lite","reasoning":"google/gemini-3.1-flash-lite","vision":"openai/gpt-6-luna"},"dataPolicy":"strict","fallbacks":[],"reasoning":{"fast":"off","reasoning":"off","vision":"minimal"},"attemptTimeoutMs":{"fast":6000,"reasoning":15000,"vision":20000},"totalTimeoutMs":45000,"maxAttempts":3,"prices":{"google/gemini-3.1-flash-lite":[0.25,1.5],"openai/gpt-6-luna":[0.1,0.5]},"keyPresent":true,"monthlyBudgetEur":50}

- Synthetic fixtures only; no real citizen data
- Accuracy checks only labelled fields; translations need human semantic review
- Language checks prove script mismatches only; Latin languages are unverified
- Final JSON includes heuristic fallback; not raw model JSON validity
- Estimated EUR cost, not provider invoice
- No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts

Detailed rows in adjacent JSON. Runtime safety success does not establish model quality.
