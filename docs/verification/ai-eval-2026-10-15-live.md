# AI eval 2026-10-15

{
  "status": "PASS",
  "reason": null,
  "mode": "live",
  "cases": 16,
  "requests": 12,
  "ai": 3,
  "heuristic": 13,
  "accuracy": 1,
  "scoredCases": 16,
  "practiceAccuracy": 1,
  "translationSemanticAccuracy": "manual_review_required",
  "translationAiCoverage": null,
  "extractionPrecision": 1,
  "extractionRecall": 1,
  "guardViolations": 0,
  "languageFailures": 0,
  "languageScriptPass": 3,
  "languageUnverified": 13,
  "jsonValidity": 1,
  "meanLatencyMs": 3184.75,
  "costEstimateEur": 0.0068690800000000005
}

Configuration: {"provider":"openrouter","models":{"fast":"deepseek/deepseek-v4.1-flash","reasoning":"deepseek/deepseek-v4.1-flash","vision":"openai/gpt-6-luna"},"dataPolicy":"strict","keyPresent":true,"monthlyBudgetEur":50}

- Synthetic fixtures only; no real citizen data
- Accuracy checks only labelled fields; translations need human semantic review
- Language checks prove script mismatches only; Latin languages are unverified
- Final JSON includes heuristic fallback; not raw model JSON validity
- Estimated EUR cost, not provider invoice
- No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts

Detailed rows in adjacent JSON. Runtime safety success does not establish model quality.

