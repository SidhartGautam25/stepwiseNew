# Build your own HTTP Server

## What we build
You will build a functional, multi-client HTTP/1.1 web server from scratch. Starting from raw operating system sockets, you will bind to a port, accept incoming TCP connections, parse RFC 7230 HTTP request lines and headers, and return properly formatted HTTP/1.1 response status lines, headers, and payloads.

## What you will learn
Throughout this workshop, you will master:
- Low-level network socket creation, binding, and listening using OS primitives.
- The mechanics of TCP three-way handshakes and connection streams.
- Robust stream-based parsing of HTTP/1.1 request lines (method, path, protocol version) and headers.
- Concurrent client handling using goroutines (Go) and thread pools/async I/O (Python).
- Connection keep-alive lifecycles and HTTP response formatting.

## Prerequisites
- Working installation of Go 1.22+ or Python 3.11+.
- Familiarity with basic terminal commands (`curl`, `nc` / `netcat`).
- Basic programming experience in either Go or Python (functions, error handling, basic I/O).

## Limitations and scope
This workshop focuses strictly on the HTTP/1.1 protocol over cleartext TCP. To keep the scope educational and laser-focused on systems networking fundamentals:
- TLS / HTTPS encryption is not covered.
- HTTP/2 binary framing and HTTP/3 QUIC streams are out of scope.
- Complex multipart form handling and chunked transfer encoding are omitted.

## How this workshop works
1. **Enroll and Clone**: Select your programming language (Go or Python) to obtain your personalized starter project.
2. **Develop Locally**: Work in your preferred IDE (VS Code, Neovim, GoLand, PyCharm) on your local workstation.
3. **Automated Verification**: Push your commits to GitHub. Handrail's verification pipeline executes black-box assertion suites against your running server binary.
4. **Adaptive Depth**: Toggle between Beginner, Intermediate, and Expert depth levels at any time for fine-grained conceptual explanations.
