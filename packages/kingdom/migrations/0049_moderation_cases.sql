CREATE TABLE moderation_cases (
 id uuid PRIMARY KEY,product_scope text NOT NULL,reporter_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
 subject_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,target_kind text NOT NULL CHECK(target_kind IN ('message','profile','post','article','court','pin','seal')),
 target_id uuid NOT NULL,category text NOT NULL,priority text NOT NULL CHECK(priority IN ('urgent','ordinary')),
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved','appealed','appeal_resolved')),
 assigned_staff_id uuid REFERENCES accounts(id) ON DELETE SET NULL,initial_reviewer_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
 access_expires_at timestamptz,created_at timestamptz NOT NULL,triage_due_at timestamptz NOT NULL,triaged_at timestamptz,
 resolved_at timestamptz,appeal_due_at timestamptz,appealed_at timestamptz,appeal_review_due_at timestamptz,
 appeal_token_hash text UNIQUE,appeal_used_at timestamptz,
 report_key uuid NOT NULL,UNIQUE(product_scope,reporter_account_id,report_key)
);
CREATE TABLE moderation_evidence (
 case_id uuid PRIMARY KEY REFERENCES moderation_cases(id) ON DELETE CASCADE,
 sealed_snapshot text NOT NULL,sealed_report text NOT NULL,sealed_appeal text
);
CREATE TABLE moderation_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,case_id uuid REFERENCES moderation_cases(id) ON DELETE CASCADE,
 product_scope text NOT NULL,staff_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
 action text NOT NULL,sealed_reason text,occurred_at timestamptz NOT NULL
);
CREATE TABLE moderation_holds (
 case_id uuid PRIMARY KEY REFERENCES moderation_cases(id) ON DELETE CASCADE,
 scope text NOT NULL CHECK(scope='reported-evidence-and-audit'),sealed_basis text NOT NULL,
 authorized_staff_ids uuid[] NOT NULL,review_at timestamptz NOT NULL,created_at timestamptz NOT NULL
);
CREATE TABLE moderation_restrictions (
 product_scope text NOT NULL,account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 case_id uuid NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('messaging','play')),until_at timestamptz NOT NULL,created_at timestamptz NOT NULL,
 PRIMARY KEY(product_scope,account_id,case_id,kind)
);
ALTER TABLE direct_messages ADD COLUMN moderation_case_id uuid;
ALTER TABLE kingdoms ADD COLUMN moderation_case_id uuid;
ALTER TABLE chronicle_posts ADD COLUMN moderation_case_id uuid;
ALTER TABLE kingdom_articles ADD COLUMN moderation_case_id uuid;
CREATE INDEX moderation_case_queue ON moderation_cases(product_scope,status,triage_due_at);

CREATE TABLE moderation_closure_jobs (
 product_scope text NOT NULL,case_id uuid PRIMARY KEY REFERENCES moderation_cases(id) ON DELETE CASCADE,
 account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,status text NOT NULL DEFAULT 'ready' CHECK(status IN ('ready','done')),
 leased_by text,lease_expires_at timestamptz
);

ALTER TABLE courts ADD COLUMN moderation_case_id uuid;
ALTER TABLE court_pins ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE, ADD COLUMN moderation_case_id uuid;
ALTER TABLE evidence_seals ADD COLUMN moderation_case_id uuid;
