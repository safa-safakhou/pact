# Reviewed local security backports

These are private source distributions of **braces3.0.3** and **node-forge1.4.0**, not upstream releases. Published fixes were unavailable on17 October2026. Their names stay unchanged; local versions explicitly identify the backport (`3.0.4-pact.1`, `1.4.1-pact.1`). Expo/React/React Native versions are unchanged. No advisory is waived or suppressed.

| Dependency | Fix | Source |
| --- | --- | --- |
| braces | Reject excessive string nesting before recursive processing; iteratively guard all public AST walkers against depth over128 and cycles, including externally supplied ASTs | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [upstream issue70](https://github.com/micromatch/braces/issues/70) |
| node-forge | Enforce nested AlgorithmIdentifier element count as well as outer DigestInfo count before accepting PKCS#1 v1.5 signatures | [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), backport of the code condition from [upstream PR1152, commitceba34402e329f0365134f23fe19898756527d65](https://github.com/digitalbazaar/forge/pull/1152) |
| Xcode's uuid | Pin published CommonJS-compatible11.1.1; Xcode usesv4, and v3/v5 bounds are fixed | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

`provenance.json` records original registry tarball URL/SRI, SHA256 of every retained original file, exact changed files and hashes of every local file. Registry tarball SRI and retained originals were independently compared during this assignment; full evidence is in the protected dependency-fix ledger. Adjacent `.patch` files expose every source/metadata difference. Upstream license texts remain included. Runtime CommonJS source is retained; unused browser-minified/Flash bundles and upstream development/lifecycle scripts are deliberately not distributed. The patched code is consumed by existing Node-based Expo tooling; no browser/native-device crypto certification is claimed.

## Resolution and verification

The root pins the exact same Expo version as the native workspace to propagate overrides across a [documented npm workspace/file-link bug](https://github.com/npm/cli/issues/9659). Root file dependencies and `$` overrides select these copies for every actual Expo/micromatch consumer, not just test imports. Xcode's nested UUID override is explicit. No package versions outside these resolutions changed in the lockfile.

Use Node24 and the project's pinned npm11.19.0. From the repository root:

```sh
npx --yes npm@11.19.0 ci --ignore-scripts --no-audit --no-fund
npm run check:dependencies
npx vitest run --config vitest.config.ts tests/unit/dependency-security.test.ts
npm audit
```

`check:dependencies` is part of `npm run lint`. It rejects changed vendor inventories/hashes, wrong root/native Expo pins, changed override wiring and any transitive consumer still loading an old copy. The behavior tests exercise the actual installed consumer dependencies, excessive balanced braces/parentheses below the original input-length limit, deep/cyclic caller ASTs, normal globbing, malformed and valid RSA DigestInfo, Xcode UUID generation/buffer rejection and actual Expo certificate/CSR/update-signature operations. Do not replace these tests with version-only assertions.

**Audit coverage:** npm reports0 known registry findings after these overrides. That result does not independently certify locally maintained code. The explicit source provenance, minimal patches, direct exploit/compatibility tests and clean-install resolution checks provide the backport evidence. Future registry reports must also be reviewed against the original upstream versions; local distributions can lack automatic advisory coverage. These distributions must not be published as official upstream versions.

## Updating or removing a backport

When upstream publishes a verified fix, review its actual security change, preserve these regression cases and update the exact dependency/override/lock together. If a backport is still needed, fetch the pinned tarball, verify its recorded SRI, retain licenses, apply/review the minimal patch, update provenance/diff/local version and rerun clean install, dependency guard, behavior tests, native bundle export, full application checks and cross-repository qualification. Never refresh hashes merely to hide unreviewed source drift. `biome` excludes third-party source to preserve byte-level upstream provenance; first-party guards/tests remain linted. Removing the root Expo pin requires proving the workspace resolver now applies every override.
