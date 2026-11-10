# Parse HTTP Request

Implementing stream-based RFC 7230 message parsing.

## Parse HTTP Request Line {#parse-request-line}

### Task
Extract the request line tokens (`Method`, `Request-Target`, `HTTP-Version`) from incoming TCP bytes and emit an RFC-compliant `HTTP/1.1 200 OK\r\n\r\n` response for valid requests.

### Theory
HTTP request lines use single-space delimiters (`0x20`) and conclude with CRLF (`\r\n` / `0x0D 0x0A`). If fewer or more than three tokens are present, or if the HTTP version is unsupported, the server must respond with `400 Bad Request` or `505 HTTP Version Not Supported`.

### Hints
Use buffered I/O (`bufio.Reader` in Go or `makefile()` in Python) to simplify line-by-line reading without dropping bytes.

## Parse HTTP Headers {#parse-headers}

### Task
Parse arbitrary HTTP header blocks into a case-insensitive map and handle the terminal empty line (`\r\n`).

### Theory
Header field names are case-insensitive ASCII tokens. Leading and trailing optional white space (OWS) around values must be stripped. The header block is terminated by two consecutive CRLF sequences (`\r\n\r\n`).

### Hints
Normalize header keys to lowercase when populating your map so lookups like `req.headers["user-agent"]` succeed regardless of client casing.
