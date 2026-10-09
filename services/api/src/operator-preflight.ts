import { readFile } from "node:fs/promises";
import { z } from "zod";

const NonEmpty = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !/\bREPLACE\b/i.test(value), "placeholder values are not allowed");
const PublicEmail = z
  .email()
  .refine((value) => !value.endsWith(".invalid"), "placeholder email domains are not allowed");
const HttpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.hostname.endsWith(".invalid");
}, "a non-placeholder HTTPS URL is required");
const EvidenceSchema = z.object({
  checkedAt: z.iso.datetime(),
  reference: NonEmpty,
});

export const OperatorRegisterSchema = z.object({
  schemaVersion: z.literal(1),
  realRegistrationEnabled: z.boolean(),
  controller: z.object({
    legalName: NonEmpty,
    contactAddress: NonEmpty,
    privacyEmail: PublicEmail,
    supportEmail: PublicEmail,
    privacyOwner: NonEmpty,
    supportOwner: NonEmpty,
  }),
  documents: z.object({
    termsVersion: NonEmpty,
    termsUrl: HttpsUrl,
    privacyVersion: NonEmpty,
    privacyUrl: HttpsUrl,
    rightsAndComplaintRoute: NonEmpty,
    privacyRequestUrl: HttpsUrl,
  }),
  processing: z.object({
    purposesAndLawfulBases: z.array(NonEmpty).min(1),
    processors: z
      .array(
        z.object({
          name: NonEmpty,
          purpose: NonEmpty,
          dataLocation: NonEmpty,
          agreementReference: NonEmpty,
          transferMechanism: NonEmpty,
        }),
      )
      .min(1),
  }),
  disclosures: z.object({
    telegram: z.literal(true),
    deviceSessions: z.literal(true),
    modelProviders: z.literal(true),
  }),
  transactionalEmail: z.object({
    mode: z.enum(["captured_smtp", "transactional"]),
    from: NonEmpty,
    deliveryEvidence: EvidenceSchema,
  }),
  operationalEvidence: z.object({
    staffMfa: EvidenceSchema,
    restore: EvidenceSchema,
    deletion: EvidenceSchema,
  }),
});

export type OperatorRegister = z.infer<typeof OperatorRegisterSchema>;

export interface PublicOperatorNotice {
  registrationEnabled: boolean;
  emailDelivery: "captured_smtp" | "transactional";
  controller: Pick<OperatorRegister["controller"], "legalName" | "contactAddress" | "privacyEmail" | "supportEmail">;
  documents: OperatorRegister["documents"];
  processors: Array<
    Pick<
      OperatorRegister["processing"]["processors"][number],
      "name" | "purpose" | "dataLocation" | "transferMechanism"
    >
  >;
  disclosures: OperatorRegister["disclosures"];
}

export class OperatorPreflight {
  private constructor(
    private readonly register: OperatorRegister | undefined,
    readonly errors: readonly string[],
  ) {}

  static unavailable(reason: string): OperatorPreflight {
    return new OperatorPreflight(undefined, [reason]);
  }

  static parse(input: unknown, currentTermsVersion?: string): OperatorPreflight {
    const parsed = OperatorRegisterSchema.safeParse(input);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` : issue.message,
      );
      return new OperatorPreflight(undefined, errors);
    }
    if (currentTermsVersion && parsed.data.documents.termsVersion !== currentTermsVersion) {
      return new OperatorPreflight(undefined, ["documents.termsVersion must match CURRENT_TERMS_VERSION"]);
    }
    return new OperatorPreflight(parsed.data, []);
  }

  get registrationEnabled(): boolean {
    return this.register?.realRegistrationEnabled === true;
  }

  publicNotice(): PublicOperatorNotice | undefined {
    if (!this.register) return undefined;
    return {
      registrationEnabled: this.registrationEnabled,
      emailDelivery: this.register.transactionalEmail.mode,
      controller: {
        legalName: this.register.controller.legalName,
        contactAddress: this.register.controller.contactAddress,
        privacyEmail: this.register.controller.privacyEmail,
        supportEmail: this.register.controller.supportEmail,
      },
      documents: this.register.documents,
      processors: this.register.processing.processors.map(({ name, purpose, dataLocation, transferMechanism }) => ({
        name,
        purpose,
        dataLocation,
        transferMechanism,
      })),
      disclosures: this.register.disclosures,
    };
  }

  report(): { ready: boolean; registrationEnabled: boolean; errors: readonly string[] } {
    return { ready: this.errors.length === 0, registrationEnabled: this.registrationEnabled, errors: this.errors };
  }
}

export async function loadOperatorPreflight(
  path: string | undefined,
  currentTermsVersion?: string,
): Promise<OperatorPreflight> {
  if (!path) return OperatorPreflight.unavailable("PACT_OPERATOR_REGISTER_FILE is not configured");
  try {
    return OperatorPreflight.parse(JSON.parse(await readFile(path, "utf8")), currentTermsVersion);
  } catch (error) {
    const message =
      error instanceof SyntaxError ? "operator register is not valid JSON" : "operator register could not be read";
    return OperatorPreflight.unavailable(message);
  }
}
