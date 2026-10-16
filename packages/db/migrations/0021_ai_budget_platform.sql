-- The monthly AI budget is now set by the platform, not by the CAF admin: values written
-- through the old settings API are dropped so every organization falls back to AI_MONTHLY_BUDGET_EUR.
UPDATE "settings" SET "ai_monthly_budget_eur" = NULL WHERE "ai_monthly_budget_eur" IS NOT NULL;
