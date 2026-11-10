# Bind to a Port

Low-level socket programming and kernel connection queues.

## Create and Bind Socket {#bind-socket}

### Task
Create an asynchronous or streaming TCP socket bound to `0.0.0.0:4221` with `SO_REUSEADDR` and `SO_REUSEPORT` flags configured where supported.

### Theory
`bind(2)` registers the endpoint in the kernel's in-memory transport table. `SO_REUSEADDR` bypasses `TIME_WAIT` socket state checks during rapid developer crash-recovery cycles.

### Hints
In Go, `net.Listen` automatically handles `SO_REUSEADDR`. In Python, invoke `s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)` prior to `bind()`.

## Listen and Accept Connections {#listen-port}

### Task
Manage connection intake queues with `listen(2)` and extract descriptors via `accept(2)`.

### Theory
The kernel maintains two queues: the incomplete connection queue (`SYN_RCVD`) and the completed connection queue (`ESTABLISHED`). Calling `accept()` pulls from the established queue.

### Hints
Monitor socket error conditions (`EINTR`, `ECONNABORTED`) to ensure the server gracefully handles aborted handshakes without crashing the master accept loop.
