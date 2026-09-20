import type { CommandReceipt, EventEnvelope } from "@pact/contracts";
import type { ProductScope, SubjectRef } from "./types.js";

export interface StockRepository {
  debit(subject: SubjectRef, asset: string, units: bigint): Promise<void>;
}

export interface AuthorityRepository {
  reserve(subject: SubjectRef, asset: string, units: bigint): Promise<void>;
}

export interface ReceiptRepository {
  save(receipt: CommandReceipt): Promise<void>;
}

export interface OutboxRepository {
  append(event: EventEnvelope): Promise<void>;
}

export interface TransactionContext {
  productScope: ProductScope;
  stock: StockRepository;
  authority: AuthorityRepository;
  receipts: ReceiptRepository;
  outbox: OutboxRepository;
}

export interface UnitOfWork {
  run<T>(productScope: ProductScope, operation: (context: TransactionContext) => Promise<T>): Promise<T>;
}
