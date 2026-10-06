"use client";

import { createContext, useContext } from "react";
import type { Operator } from "@avanti/contracts";

type OperatorState = {
  operator: Operator;
  reload: () => void;
  replace: (operator: Operator) => void;
};

const OperatorContext = createContext<OperatorState | null>(null);

export const OperatorProvider = OperatorContext.Provider;

function useOperatorState() {
  const state = useContext(OperatorContext);
  if (!state) throw new Error("Operator hooks must be used inside the console layout");
  return state;
}

export const useOperator = () => useOperatorState().operator;

/** Refetch the profile, e.g. after offices change. */
export const useReloadOperator = () => useOperatorState().reload;

/** Replace the profile with a fresh one returned by the API (e.g. after a password change). */
export const useReplaceOperator = () => useOperatorState().replace;
