import type {
  CommandReceipt,
  ProductScope as ContractProductScope,
  SubjectRef as ContractSubjectRef,
  EventEnvelope,
} from "@pact/contracts";

export type ProductScope = ContractProductScope;
export type Principal = Readonly<{ id: string; productScope: ProductScope; audience: "human" | "agent" | "service" }>;
export type SubjectRef = Readonly<ContractSubjectRef>;
export type Action<TType extends string = string, TPayload = unknown> = Readonly<{ type: TType; payload: TPayload }>;
export type Receipt = CommandReceipt;
export type Event = EventEnvelope;

export interface Clock {
  now(): Date;
}
export interface RandomSource {
  bytes(length: number): Uint8Array;
}
