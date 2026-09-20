import type { Clock, UnitOfWork } from "@pact/platform";
import { CommandDispatcher, type CommandDispatcherOptions } from "./dispatcher.js";

export interface ApplicationDependencies {
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}

export interface Application {
  readonly dependencies: ApplicationDependencies;
  readonly dispatcher?: CommandDispatcher;
}

export function createApplication(
  dependencies: ApplicationDependencies,
  dispatcherOptions?: CommandDispatcherOptions,
): Application {
  return Object.freeze({
    dependencies,
    ...(dispatcherOptions ? { dispatcher: new CommandDispatcher(dispatcherOptions) } : {}),
  });
}

export { canonicalPayloadHash } from "./canonical.js";
export { CommandDispatcher } from "./dispatcher.js";
export { type AuthenticatedPrincipal, DispatcherError, type DispatcherFailureCode } from "./types.js";
