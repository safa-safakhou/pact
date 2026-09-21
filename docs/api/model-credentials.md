# Model credential API and operations

`@pact/credential-vault` owns encrypted provider credentials for OpenAI, Anthropic, Gemini, xAI, and OpenRouter. A human account may keep at most one active credential per provider and five active credentials overall.

The cookie-authenticated API exposes:

- `GET /v1/model-connections` — returns labels, four-character suffixes, versions, and status only.
- `POST /v1/model-connections` — saves `{ provider, label, credential }` with Origin and CSRF proof.
- `PUT /v1/model-connections/:credentialId` — replaces `{ credential, expectedVersion, label? }`; also requires human reauthentication within five minutes.
- `POST /v1/model-connections/:credentialId/revoke` — immediately blocks new admission and deletes the live ciphertext and wrapped data key.

All responses use `Cache-Control: no-store`. The account ID always comes from the human session. Credentials, ciphertext, wrapped data keys, and private wrapping material are absent from reads and are not MCP resources or tool arguments.

## Single-VPS key boundary

Generate an RSA wrapping key pair outside the application containers:

```sh
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out model-credential-private.pem
openssl pkey -in model-credential-private.pem -pubout -out model-credential-public.pem
```

Mount `model-credential-public.pem` read-only into the API container and set:

```text
MODEL_CREDENTIAL_WRAPPING_PUBLIC_KEY_FILE=/run/secrets/model-credential-public.pem
MODEL_CREDENTIAL_WRAPPING_KEY_ID=vps-primary-v1
```

Mount the private file only into the inference container. Its composition root calls `createInferenceCredentialResolver` with the private bytes and accepted key IDs. Do not put the private key in a shared environment file, API mount, image, log, or database. VPS root is the trusted operator under the approved architecture.

Each save or replacement creates a fresh 256-bit data key and AES-256-GCM nonce. The ciphertext authentication data binds product, account, credential ID, provider, and version, so moving encrypted columns to another account or record fails closed. The API-side RSA-OAEP-SHA256 adapter has no unwrap capability; only the inference-side adapter can unwrap a data key.

Keep old private keys available to inference while records still reference their key IDs. A rotation may write new credentials under a new ID and deliberately rewrap old data keys; never silently relabel old ciphertext with a new key ID.

## Revocation semantics

Inference admits a credential use in PostgreSQL before making the provider request, then performs decryption and the network call outside the transaction. Revocation locks the record, clears every encrypted field immediately, increments the version, records an audit event, and appends `model-credential.revoked.v1` without secret material.

A request admitted before revocation may finish because the provider has already received it. The use ledger reports that completion truthfully. Every new admission after revocation fails, and PACT never claims it recalled a provider request.
