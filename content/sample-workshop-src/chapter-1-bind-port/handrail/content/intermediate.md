# Bind to a Port

Welcome to Chapter 1! In this chapter, you will construct a streaming TCP server listening on port 4221.

## Create and Bind Socket {#bind-socket}

### Task
Create an IPv4 streaming TCP socket and bind it to address `0.0.0.0:4221`.

### Theory
The BSD socket API abstracts kernel network drivers. Calling `bind(2)` binds the naming tuple `(proto, ip, port)` to a socket file descriptor. If another process already holds the port, `EADDRINUSE` is returned.

### Hints
Consider setting `SO_REUSEADDR` to avoid `bind: address already in use` errors during fast server restarts.

## Listen and Accept Connections {#listen-port}

### Task
Configure a TCP connection backlog queue and accept established incoming connection requests.

### Theory
The TCP three-way handshake (`SYN`, `SYN-ACK`, `ACK`) is completed by the operating system kernel before returning from `accept()`. A non-blocking event loop or dedicated connection dispatch worker handles each connection.

### Hints
Do not close the listening socket when handling a client; accept returns a distinct descriptor for the connection.
