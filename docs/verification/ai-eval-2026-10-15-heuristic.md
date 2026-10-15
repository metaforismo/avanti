# AI eval 2026-10-15

{
  "status": "PASS",
  "reason": null,
  "mode": "heuristic",
  "cases": 74,
  "requests": 0,
  "ai": 0,
  "heuristic": 74,
  "accuracy": 0.9827586206896551,
  "scoredCases": 58,
  "practiceAccuracy": 1,
  "translationSemanticAccuracy": "manual_review_required",
  "translationAiCoverage": 0,
  "extractionPrecision": 1,
  "extractionRecall": 1,
  "guardViolations": 0,
  "languageFailures": 0,
  "languageScriptPass": 12,
  "languageUnverified": 62,
  "jsonValidity": 1,
  "meanLatencyMs": 14.837837837837839,
  "costEstimateEur": 0
}

Configuration: {"provider":"none","models":{"fast":"disabled","reasoning":"disabled","vision":"disabled"},"dataPolicy":"strict","keyPresent":false,"monthlyBudgetEur":50}

- Synthetic fixtures only; no real citizen data
- Accuracy checks only labelled fields; translations need human semantic review
- Language checks prove script mismatches only; Latin languages are unverified
- Final JSON includes heuristic fallback; not raw model JSON validity
- Estimated EUR cost, not provider invoice
- No provider call unless AI_LIVE=1; live hard cap 200 cases with bounded runtime attempts

Detailed rows in adjacent JSON. Runtime safety success does not establish model quality.

