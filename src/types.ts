import type { Context } from "hono";
import type { AppBindings } from "./bindings";

export type AppContext = Context<{ Bindings: AppBindings }>;
