# Assistant client compatibility

Ticket: PACT-086.

`GET /v1/client-compatibility` publishes the additional assistant-client certification matrix. A row distinguishes model API support from actual host certification, consumer-app installation, credential eligibility/billing, proven capabilities, readable/writable surfaces, client version/date, evidence, and limitations.

`certified` means the named real client completed OAuth, scoped read/write, approval, result retrieval, and revocation. `fixture_only` means recorded protocol/provider fixtures passed but a live host route did not. `not_tested` advertises no route support. Model API support alone never changes either status.

The current environment has neither Gemini CLI nor eligible Gemini/xAI test credentials. Consequently Gemini CLI is `not_tested`, and the Grok-powered external-client row is `fixture_only`; consumer Gemini/Grok installation is not advertised.
