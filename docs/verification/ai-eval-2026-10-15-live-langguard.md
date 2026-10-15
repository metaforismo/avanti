# AI eval 2026-10-15

{
"status": "PASS",
"reason": null,
"mode": "live",
"cases": 200,
"requests": 222,
"ai": 191,
"servedModels": {
"deepseek/deepseek-v4.1-flash": 186,
"openai/gpt-6-luna": 5
},
"heuristic": 9,
"accuracy": 0.9945652173913043,
"scoredCases": 184,
"practiceAccuracy": 1,
"translationSemanticAccuracy": "manual_review_required",
"translationAiCoverage": 1,
"extractionPrecision": 1,
"extractionRecall": 1,
"guardViolations": 0,
"languageFailures": 0,
"languageScriptPass": 68,
"languageUnverified": 132,
"jsonValidity": 1,
"textMedianLatencyMs": 1249,
"textP95LatencyMs": 4000,
"fallbackRate": 0.045,
"meanLatencyMs": 1677.94,
"costEstimateEur": 0.03302479
}

Configuration: {"provider":"openrouter","models":{"fast":"deepseek/deepseek-v4.1-flash","audio":"google/gemini-3.5-flash-lite","reasoning":"deepseek/deepseek-v4.1-flash","vision":"openai/gpt-6-luna"},"dataPolicy":"strict","fallbacks":["openai/gpt-6-luna"],"reasoning":{"fast":"off","reasoning":"minimal","vision":"minimal","audio":"minimal"},"attemptTimeoutMs":{"fast":6000,"reasoning":25000,"vision":20000,"audio":20000},"totalTimeoutMs":45000,"maxAttempts":3,"prices":{"deepseek/deepseek-v4.1-flash":[0.03,0.7],"openai/gpt-6-luna":[0.1,0.5]},"keyPresent":true,"monthlyBudgetEur":50}

- Synthetic fixtures only; no real citizen data
- Accuracy checks only labelled fields; translations need human semantic review
- Language checks prove script mismatches only; Latin languages are unverified
- Final JSON includes heuristic fallback; not raw model JSON validity
- Estimated EUR cost, not provider invoice
- No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts

Detailed rows in adjacent JSON. Runtime safety success does not establish model quality.
