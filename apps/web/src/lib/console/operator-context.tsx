"use client";

import { createContext, useContext } from "react";
import type { Operator } from "@avanti/contracts";

const OperatorContext = createContext<Operator | null>(null);

export const OperatorProvider = OperatorContext.Provider;

export function useOperator() {
  const operator = useContext(OperatorContext);
  if (!operator) throw new Error("useOperator must be used inside the console layout");
  return operator;
}
