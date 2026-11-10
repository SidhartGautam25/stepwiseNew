# Parse HTTP Request

High-performance zero-copy protocol parsers.

## Parse HTTP Request Line {#parse-request-line}

### Task
Implement state-machine parsing for HTTP/1.1 request lines with defensive bounds checking against buffer overruns and malformed URI schemes.

### Theory
RFC 7230 Section 3.1.1 strictly mandates parsing without assuming complete packet arrival on a single `recv` call. Streaming scanners identify byte indices of delimiters (`SP`, `CRLF`) without heap allocations where possible.

### Hints
Ensure you reject request lines exceeding standard header length limits (e.g., 8192 bytes) with `414 URI Too Long`.

## Parse HTTP Headers {#parse-headers}

### Task
Stream-parse header key-value collections with support for repeated headers and whitespace normalization.

### Theory
Headers may span multiple TCP segments. When headers arrive fragmented across TCP window frames, parser state machines maintain pointer offsets until `\r\n\r\n` is detected.

### Hints
Protect against header injection attacks and slowloris attacks by enforcing maximum header count (e.g. 100) and cumulative header block size limits.
