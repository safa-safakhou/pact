import type { InvitationDestination, SetupStep } from "@pact/client-sdk";
import { buildSetupSnapshot, toPricingMessage, toRunStatusLabel, toSetupErrorMessage } from "@pact/client-sdk";
import type { FormEvent, ReactElement } from "react";
import "./setup.css";

export interface SetupProviderOption {
  readonly id: string;
  readonly label: string;
}

export interface SetupModelOption {
  readonly id: string;
  readonly label: string;
}

export interface SetupApprovalItem {
  readonly id: string;
  readonly summary: string;
  readonly status?: "pending" | "expired" | "decided";
}

export interface SetupFlowProps {
  readonly step: SetupStep;
  readonly onStepChange?: (step: SetupStep) => void;
  readonly invitation?: InvitationDestination;
  /** Hydrated from the API so closing/reopening reflects server state. */
  readonly serverHydrated?: boolean;
  readonly errorCode?: string;
  readonly accountEmail?: string;
  readonly onAccountSubmit?: (input: { email: string; password: string }) => void;
  readonly draftDisplayName?: string;
  readonly draftHandle?: string;
  readonly onDraftSubmit?: (input: { displayName: string; handle: string }) => void;
  readonly providers?: readonly SetupProviderOption[];
  readonly selectedProviderId?: string;
  readonly onSelectProvider?: (providerId: string) => void;
  readonly credentialHint?: string;
  readonly onCredentialsSubmit?: (input: { label: string; secret: string }) => void;
  readonly models?: readonly SetupModelOption[];
  readonly selectedModelId?: string;
  readonly onSelectModel?: (modelId: string) => void;
  readonly allowanceTokens?: number;
  readonly pricingAvailable?: boolean;
  readonly pricingEstimateText?: string;
  readonly onConfirmAllowance?: () => void;
  readonly runStatus?: string;
  readonly externalHostMessage?: string;
  readonly connectorPrerequisiteMessage?: string;
  readonly onStartRun?: () => void;
  readonly onStopRun?: () => void;
  readonly approvals?: readonly SetupApprovalItem[];
  readonly onApprove?: (approvalId: string) => void;
  readonly onDeny?: (approvalId: string) => void;
}

const STEP_TITLES: Record<SetupStep, string> = {
  account: "Account and security",
  draft: "Private kingdom draft",
  provider: "Choose a model provider",
  credentials: "Add provider credentials",
  model: "Choose a model",
  allowance: "Confirm run allowance",
  run: "Envoy run controls",
  inbox: "Approval inbox",
};

function InvitationBanner({ invitation }: { invitation: InvitationDestination }): ReactElement | null {
  if (!invitation.invite && !invitation.destination) return null;
  const parts = [
    invitation.invite ? `invite ${invitation.invite}` : null,
    invitation.destination ? `destination ${invitation.destination}` : null,
  ].filter(Boolean);
  return (
    <p className="pact-setup__destination" data-testid="invitation-destination">
      Invitation preserved: {parts.join(" · ")}
    </p>
  );
}

function StepNav(props: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextType?: "button" | "submit";
  showNext?: boolean;
}): ReactElement {
  const showNext = props.showNext === true || props.onNext !== undefined || props.nextType === "submit";
  return (
    <div className="pact-setup__actions">
      {props.onBack ? (
        <button type="button" className="pact-touch-target" onClick={props.onBack}>
          Back
        </button>
      ) : null}
      {showNext ? (
        <button
          type={props.nextType ?? "button"}
          className="pact-touch-target pact-touch-target--primary"
          onClick={props.nextType === "submit" ? undefined : props.onNext}
        >
          {props.nextLabel ?? "Continue"}
        </button>
      ) : null}
    </div>
  );
}

export function SetupFlow(props: SetupFlowProps): ReactElement {
  const invitation = props.invitation ?? {};
  const snapshot = buildSetupSnapshot({
    step: props.step,
    invitation,
    ...(props.runStatus !== undefined ? { runStatus: props.runStatus } : {}),
    pricing: {
      available: props.pricingAvailable === true,
      ...(props.pricingEstimateText !== undefined ? { estimateText: props.pricingEstimateText } : {}),
    },
    ...(props.errorCode !== undefined ? { errorCode: props.errorCode } : {}),
    ...(props.externalHostMessage !== undefined ? { externalHostMessage: props.externalHostMessage } : {}),
    ...(props.connectorPrerequisiteMessage !== undefined
      ? { connectorPrerequisiteMessage: props.connectorPrerequisiteMessage }
      : {}),
    serverState: props.serverHydrated === true ? { hydrated: true } : {},
  });
  const pricing = toPricingMessage({
    available: props.pricingAvailable === true,
    ...(props.pricingEstimateText !== undefined ? { estimateText: props.pricingEstimateText } : {}),
  });
  const runLabel = toRunStatusLabel(props.runStatus ?? "stopped");
  const errorMessage = props.errorCode ? toSetupErrorMessage(props.errorCode) : snapshot.errorMessage;

  const go = (step: SetupStep): void => {
    props.onStepChange?.(step);
  };

  const onAccountForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    props.onAccountSubmit?.({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? ""),
    });
    go("draft");
  };

  const onDraftForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    props.onDraftSubmit?.({
      displayName: String(data.get("displayName") ?? ""),
      handle: String(data.get("handle") ?? ""),
    });
    go("provider");
  };

  const onCredentialsForm = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    props.onCredentialsSubmit?.({
      label: String(data.get("label") ?? ""),
      secret: String(data.get("secret") ?? ""),
    });
    go("model");
  };

  return (
    <section className="pact-setup" data-step={props.step}>
      <p className="pact-setup__eyebrow">PACT · Setup</p>
      <h1 className="pact-setup__title">{STEP_TITLES[props.step]}</h1>
      <InvitationBanner invitation={invitation} />
      {props.serverHydrated ? (
        <p className="pact-setup__notice" data-testid="server-hydrated">
          Showing server state. Closing and reopening this page reloads your private draft and run status from the API.
        </p>
      ) : null}
      {errorMessage ? (
        <p className="pact-setup__alert" role="alert" data-testid="setup-error">
          {errorMessage}
        </p>
      ) : null}
      <p className="pact-setup__hint">
        This flow keeps a private draft only. Connecting an Envoy or approving a sandbox action does not found a live
        kingdom.
      </p>

      {props.step === "account" ? (
        <form className="pact-setup__panel" onSubmit={onAccountForm}>
          <p className="pact-setup__lede">Create your account and set a password. Email verification follows signup.</p>
          <div className="pact-setup__field">
            <label htmlFor="pact-email">Email</label>
            <input
              id="pact-email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={props.accountEmail ?? ""}
              required
              className="pact-touch-target"
            />
          </div>
          <div className="pact-setup__field">
            <label htmlFor="pact-password">Password</label>
            <input
              id="pact-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="pact-touch-target"
            />
          </div>
          <StepNav nextLabel="Save account" nextType="submit" />
        </form>
      ) : null}

      {props.step === "draft" ? (
        <form className="pact-setup__panel" onSubmit={onDraftForm}>
          <p className="pact-setup__lede">
            Name your private draft. It has no military or economic identity until you later found a kingdom.
          </p>
          <div className="pact-setup__field">
            <label htmlFor="pact-display-name">Display name</label>
            <input
              id="pact-display-name"
              name="displayName"
              type="text"
              defaultValue={props.draftDisplayName ?? ""}
              required
              className="pact-touch-target"
            />
          </div>
          <div className="pact-setup__field">
            <label htmlFor="pact-handle">Proposed handle</label>
            <input
              id="pact-handle"
              name="handle"
              type="text"
              defaultValue={props.draftHandle ?? ""}
              required
              className="pact-touch-target"
            />
          </div>
          <StepNav onBack={() => go("account")} nextLabel="Save draft" nextType="submit" />
        </form>
      ) : null}

      {props.step === "provider" ? (
        <div className="pact-setup__panel">
          <p className="pact-setup__lede">Select where PACT should send model requests for this connection.</p>
          <div className="pact-setup__field">
            <label htmlFor="pact-provider">Provider</label>
            <select
              id="pact-provider"
              className="pact-touch-target"
              value={props.selectedProviderId ?? ""}
              onChange={(event) => props.onSelectProvider?.(event.target.value)}
            >
              <option value="" disabled>
                Select a provider
              </option>
              {(props.providers ?? []).map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </div>
          {props.connectorPrerequisiteMessage ? (
            <p className="pact-setup__notice" data-testid="connector-prerequisite">
              {props.connectorPrerequisiteMessage}
            </p>
          ) : null}
          <StepNav
            onBack={() => go("draft")}
            nextLabel="Continue"
            onNext={() => {
              if (props.selectedProviderId) go("credentials");
            }}
          />
        </div>
      ) : null}

      {props.step === "credentials" ? (
        <form className="pact-setup__panel" onSubmit={onCredentialsForm}>
          <p className="pact-setup__lede">
            Paste a provider API credential. Keys are encrypted at rest and never shown again in full.
          </p>
          {props.credentialHint ? <p className="pact-setup__meta">{props.credentialHint}</p> : null}
          <div className="pact-setup__field">
            <label htmlFor="pact-cred-label">Label</label>
            <input id="pact-cred-label" name="label" type="text" required className="pact-touch-target" />
          </div>
          <div className="pact-setup__field">
            <label htmlFor="pact-cred-secret">API key</label>
            <input
              id="pact-cred-secret"
              name="secret"
              type="password"
              autoComplete="off"
              required
              className="pact-touch-target"
            />
          </div>
          <StepNav onBack={() => go("provider")} nextLabel="Store credential" nextType="submit" />
        </form>
      ) : null}

      {props.step === "model" ? (
        <div className="pact-setup__panel">
          <p className="pact-setup__lede">Choose the model this Envoy will use for the bounded sandbox run.</p>
          <div className="pact-setup__field">
            <label htmlFor="pact-model">Model</label>
            <select
              id="pact-model"
              className="pact-touch-target"
              value={props.selectedModelId ?? ""}
              onChange={(event) => props.onSelectModel?.(event.target.value)}
            >
              <option value="" disabled>
                Select a model
              </option>
              {(props.models ?? []).map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
          <StepNav
            onBack={() => go("credentials")}
            nextLabel="Continue"
            onNext={() => {
              if (props.selectedModelId) go("allowance");
            }}
          />
        </div>
      ) : null}

      {props.step === "allowance" ? (
        <div className="pact-setup__panel">
          <p className="pact-setup__lede">
            Confirm the token allowance before the first run. Costs never invent a zero price.
          </p>
          <p className="pact-setup__meta">Token allowance: {props.allowanceTokens ?? 0}</p>
          <p className="pact-setup__meta" data-testid="pricing-message">
            {pricing.text}
          </p>
          <StepNav
            onBack={() => go("model")}
            nextLabel="Confirm allowance"
            onNext={() => {
              props.onConfirmAllowance?.();
              go("run");
            }}
          />
        </div>
      ) : null}

      {props.step === "run" ? (
        <div className="pact-setup__panel">
          <p className="pact-setup__lede">Start a bounded Envoy run. Status labels stay truthful.</p>
          <p className="pact-setup__meta">
            Status:{" "}
            <span className="pact-setup__status" data-testid="run-status">
              {runLabel}
            </span>
          </p>
          {props.externalHostMessage ? (
            <p className="pact-setup__notice" data-testid="external-host-usage">
              {props.externalHostMessage}
            </p>
          ) : null}
          {props.connectorPrerequisiteMessage ? (
            <p className="pact-setup__notice" data-testid="connector-prerequisite">
              {props.connectorPrerequisiteMessage}
            </p>
          ) : null}
          <div className="pact-setup__actions">
            <button type="button" className="pact-touch-target pact-touch-target--primary" onClick={props.onStartRun}>
              Start run
            </button>
            <button type="button" className="pact-touch-target" onClick={props.onStopRun}>
              Stop run
            </button>
            <button type="button" className="pact-touch-target" onClick={() => go("inbox")}>
              Open approval inbox
            </button>
            <button type="button" className="pact-touch-target" onClick={() => go("allowance")}>
              Back
            </button>
          </div>
        </div>
      ) : null}

      {props.step === "inbox" ? (
        <div className="pact-setup__panel">
          <p className="pact-setup__lede">
            Review exact-command approvals from your Envoy. Expired items need a new request.
          </p>
          <ul className="pact-setup__list">
            {(props.approvals ?? []).map((approval) => (
              <li key={approval.id} className="pact-setup__list-item">
                <div>
                  <strong>{approval.summary}</strong>
                  {approval.status === "expired" ? (
                    <p className="pact-setup__meta">{toSetupErrorMessage("EXPIRED")}</p>
                  ) : null}
                </div>
                <div className="pact-setup__actions">
                  <button
                    type="button"
                    className="pact-touch-target pact-touch-target--primary"
                    onClick={() => props.onApprove?.(approval.id)}
                    disabled={approval.status === "expired"}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="pact-touch-target"
                    onClick={() => props.onDeny?.(approval.id)}
                    disabled={approval.status === "expired"}
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {(props.approvals ?? []).length === 0 ? <p className="pact-setup__meta">No pending approvals.</p> : null}
          <StepNav onBack={() => go("run")} />
        </div>
      ) : null}
    </section>
  );
}
