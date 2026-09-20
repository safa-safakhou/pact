import type { Clock, UnitOfWork } from "@pact/platform";

export interface ApplicationDependencies {
  readonly clock: Clock;
  readonly unitOfWork: UnitOfWork;
}

export interface Application {
  readonly dependencies: ApplicationDependencies;
}

export function createApplication(dependencies: ApplicationDependencies): Application {
  return Object.freeze({ dependencies });
}
