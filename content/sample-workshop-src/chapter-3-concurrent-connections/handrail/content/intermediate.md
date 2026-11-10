# Handle Concurrent Connections

Concurrency architectures and HTTP/1.1 connection persistence.

## Serve Multiple Clients Simultaneously {#concurrent-clients}

### Task
Implement a concurrent connection processing model using green threads (Go goroutines) or thread pools (Python).

### Theory
Concurrency primitives multiplex thousands of active TCP connections across hardware CPU cores. In Go, M:N green thread scheduling multiplexes goroutines onto OS threads efficiently with small initial stacks (2KB). In Python, thread pools or non-blocking async loops prevent slow clients from starving active connections.

### Hints
Ensure shared server state (metrics, caches) is protected with mutual exclusion locks (`sync.Mutex` or `threading.Lock`).

## Support Persistent Keep-Alive Connections {#connection-keep-alive}

### Task
Implement RFC 7230 Section 6.3 persistent connection persistence and idle socket timeouts.

### Theory
In HTTP/1.1, connections are persistent by default unless explicitly closed via `Connection: close`. The server must indicate the boundary of each message using `Content-Length` or `Transfer-Encoding: chunked` so the client can determine when one response finishes and the next begins.

### Hints
Always emit a valid `Content-Length` header on responses during keep-alive sessions, otherwise clients cannot reliably parse multiple consecutive HTTP responses.
