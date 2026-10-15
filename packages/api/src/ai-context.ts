import { AsyncLocalStorage } from "node:async_hooks";
import type { TaskContext } from "@avanti/ai";
export const aiContext = new AsyncLocalStorage<TaskContext>();
