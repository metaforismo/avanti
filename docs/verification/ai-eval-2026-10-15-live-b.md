# AI eval B — 15 ottobre 2026

```json
{
  "status": "PASS",
  "reason": null,
  "mode": "live",
  "cases": 74,
  "requests": 93,
  "ai": 74,
  "servedModels": {
    "openai/gpt-6-luna": 6,
    "deepseek/deepseek-v4.1-flash": 68
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
  "textMedianLatencyMs": 1510.5,
  "textP95LatencyMs": 7873,
  "fallbackRate": 0,
  "meanLatencyMs": 2383.391891891892,
  "costEstimateEur": 0.026836000000000006,
  "aiOnlyAccuracy": 1.0
}
```

Configurazione: `{"provider": "openrouter", "models": {"fast": "openai/gpt-6-luna", "reasoning": "openai/gpt-6-luna", "vision": "openai/gpt-6-luna"}, "dataPolicy": "strict", "fallbacks": ["deepseek/deepseek-v4.1-flash"], "reasoning": {"fast": "off", "reasoning": "minimal", "vision": "minimal"}, "attemptTimeoutMs": {"fast": 6000, "reasoning": 15000, "vision": 20000}, "totalTimeoutMs": 45000, "maxAttempts": 3, "prices": {"deepseek/deepseek-v4.1-flash": [0.03, 0.7], "openai/gpt-6-luna": [0.1, 0.5]}, "keyPresent": true, "monthlyBudgetEur": 50}`

Versioni: `{"intake.understand": "1.3", "interview.freeform": "1.3", "translate": "1.3", "document.analyze": "1.1"}`

Risposte e tempi grezzi nel [JSON](ai-eval-2026-10-15-live-b.json). Mediana convenzionale; p95 nearest rank. Dataset sintetico, costi stimati, semantica delle traduzioni da revisionare.
