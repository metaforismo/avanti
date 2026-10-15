# AI eval A — 15 ottobre 2026

```json
{
  "status": "PASS",
  "reason": null,
  "mode": "live",
  "cases": 74,
  "requests": 86,
  "ai": 73,
  "servedModels": {
    "deepseek/deepseek-v4.1-flash": 72,
    "openai/gpt-6-luna": 1
  },
  "heuristic": 1,
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
  "textMedianLatencyMs": 1228.0,
  "textP95LatencyMs": 3559,
  "fallbackRate": 0.013513513513513514,
  "meanLatencyMs": 2131.3513513513512,
  "costEstimateEur": 0.01680444,
  "aiOnlyAccuracy": 1.0
}
```

Configurazione: `{"provider": "openrouter", "models": {"fast": "deepseek/deepseek-v4.1-flash", "reasoning": "deepseek/deepseek-v4.1-flash", "vision": "openai/gpt-6-luna"}, "dataPolicy": "strict", "fallbacks": ["openai/gpt-6-luna"], "reasoning": {"fast": "off", "reasoning": "minimal", "vision": "minimal"}, "attemptTimeoutMs": {"fast": 6000, "reasoning": 15000, "vision": 20000}, "totalTimeoutMs": 45000, "maxAttempts": 3, "prices": {"deepseek/deepseek-v4.1-flash": [0.03, 0.7], "openai/gpt-6-luna": [0.1, 0.5]}, "keyPresent": true, "monthlyBudgetEur": 50}`

Versioni: `{"intake.understand": "1.3", "interview.freeform": "1.3", "translate": "1.3", "document.analyze": "1.1"}`

Risposte e tempi grezzi nel [JSON](ai-eval-2026-10-15-live-a.json). Mediana convenzionale; p95 nearest rank. Dataset sintetico, costi stimati, semantica delle traduzioni da revisionare.
