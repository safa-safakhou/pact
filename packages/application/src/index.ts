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

export { describeApprovalEffects } from "./approval-effects.js";
export { canonicalPayloadHash } from "./canonical.js";
export { CommandDispatcher, type GameCommandMutation, type GameCommandPort } from "./dispatcher.js";
export { GameCommandHandler } from "./game-command-handler.js";
export { dispatchRunCommandTools, pactRunCommandTool, runToolCommandId } from "./run-game-tools.js";
export { SocialCommandHandler } from "./social-command-handler.js";
export { type AuthenticatedPrincipal, DispatcherError, type DispatcherFailureCode } from "./types.js";
