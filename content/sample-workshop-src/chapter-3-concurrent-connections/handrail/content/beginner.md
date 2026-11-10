# Handle Concurrent Connections

In this chapter, you will enable your HTTP server to handle multiple client connections concurrently and reuse connections with HTTP keep-alive.

## Serve Multiple Clients Simultaneously {#concurrent-clients}

### Task
Update your connection handling logic so that slow or multiple concurrent client requests do not block other clients from connecting and receiving responses.

### Theory
A single-threaded, sequential server processes one client at a time. If Client A takes 5 seconds to send its request, Client B must wait in the OS listen queue. Handling each connection in its own thread or goroutine allows the server to process requests simultaneously.

### Hints
In Go, spawn a goroutine `go handleConnection(conn)`. In Python, use the `threading` module to run `threading.Thread(target=handle_client, args=(conn,)).start()`.

## Support Persistent Keep-Alive Connections {#connection-keep-alive}

### Task
Allow multiple request/response cycles over the same TCP socket when the client requests `Connection: keep-alive` (default in HTTP/1.1), closing the connection only when `Connection: close` is specified or when the client disconnects.

### Theory
Opening a new TCP connection involves a 3-way handshake and slow-start congestion window ramp-up. HTTP/1.1 persistent connections keep the socket open across multiple requests, drastically reducing latency and server overhead.

### Hints
Wrap your request parsing and response handling in an inner `for` loop over the active socket connection. Break from the loop only when EOF is encountered or when `Connection: close` is received.
