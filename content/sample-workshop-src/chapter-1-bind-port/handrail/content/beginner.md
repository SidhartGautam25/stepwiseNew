# Bind to a Port

Welcome to Chapter 1! In this chapter, you will create a TCP listener socket that binds to port 4221 on localhost.

## Create and Bind Socket {#bind-socket}

### Task
Open a TCP socket bound to `0.0.0.0:4221` (or `127.0.0.1:4221`) so external clients can establish a network handshake with your process.

### Theory
A network socket is an endpoint for sending or receiving data across a computer network. Binding assigns a specific local transport address (IP address and port number) to the socket so the operating system kernel knows where to route incoming TCP packets.

### Hints
In Go, use `net.Listen("tcp", "0.0.0.0:4221")`. In Python, create a socket using `socket.socket(socket.AF_INET, socket.SOCK_STREAM)` and call `s.bind(('0.0.0.0', 4221))`.

## Listen and Accept Connections {#listen-port}

### Task
Transition the socket to listening mode and call `Accept()` to establish incoming client TCP connections.

### Theory
Calling `listen()` marks the socket as passive—ready to accept incoming connections. Calling `accept()` extracts the first connection request on the queue of pending connections, creates a new connected socket, and returns a new file descriptor referring to that socket.

### Hints
Run a loop that calls `listener.Accept()` (Go) or `s.accept()` (Python). Ensure you close or handle the client connection after reading.
