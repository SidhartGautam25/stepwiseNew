# ADR 0010: Deterministic Packaging, Secret Isolation, and Safe Extraction

## Status
Accepted

## Context
When distributing starter code to learners and test bundles to the verification service, Handrail must guarantee:
1. **Determinism**: The same content must always produce identical byte-for-byte archives (identical SHA256 checksums) across different OS platforms, environments, and build times. This enables content-addressable storage, reliable cache invalidation, and reproducible builds.
2. **Secret & Test Isolation**: Learner-facing starter zips must never contain hidden tests, future solutions, Git histories (`.git`), or OS-specific junk (`.DS_Store`, `Thumbs.db`).
3. **Internal Test Protection**: Test bundles containing test specs and assertions must be accessible solely by verification workers via signed URLs generated through internal service-scoped endpoints, never via public or learner-JWT endpoints.
4. **Archive Security**: Decompressing tarballs or zips from Git/GitHub must protect against directory traversal attacks (`../`), absolute paths, and malicious symlinks.

## Decision
1. **Deterministic Archive Builders**:
   - Packagers sort all file entries lexicographically by normalized POSIX path (`/`).
   - File modification times (`mtime`) are clamped to a static epoch timestamp (`2026-01-01T00:00:00.000Z` / `1767225600`).
   - Standard Unix permissions are normalized (e.g. `0o644` for regular files, `0o755` for directories and executables).
   - Starters are formatted as deterministic ZIP files. Test bundles are formatted as deterministic gzipped tarballs (`.tar.gz`).

2. **Strict Starter Allow-Listing**:
   - The starter packager only includes files strictly located under `starters/<language>/` of the `main` branch.
   - Exclusion filters reject `.git`, `.DS_Store`, `Thumbs.db`, `.env*`, and editor metadata.
   - Handrail config (`handrail.yaml`) and default GitHub Actions workflow (`.github/workflows/verify.yml`) are included.

3. **Restricted Test Bundle Access**:
   - Test bundles contain `handrail/tests/*` and a generated `manifest.json` marking test IDs and `hidden` flags.
   - Test bundles are stored in private MinIO/S3 buckets and can only be accessed by internal service callers possessing `@ServiceOnly('catalog:tests:read')` credentials via temporary signed URLs (5-minute TTL).

4. **Safe Archive Extraction Guard**:
   - During ingest, incoming repository archives are parsed with strict validation:
     - Entries containing `..` or leading `/` are immediately rejected.
     - Symlinks, hardlinks, device files, and FIFO entries are discarded or rejected.
     - Maximum file count (default 5,000 files) and uncompressed archive size limits (default 100MB) are enforced to defend against zip bombs.

## Consequences
- **Positive**: Cryptographically verifiable archive checksums, zero test leakage in learner starters, defense-in-depth against malicious payloads.
- **Negative**: Archive creation requires custom normalization logic rather than default system zip/tar utilities.
