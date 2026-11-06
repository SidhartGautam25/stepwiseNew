package main

import (
	"fmt"
	"net"
	"os"
)

func main() {
	fmt.Println("Handrail: Starting Redis clone...")

	// TODO: Step 1 - Bind port 6379 and accept TCP connections
	l, err := net.Listen("tcp", "0.0.0.0:6379")
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to bind to port 6379: %s\n", err)
		os.Exit(1)
	}
	defer l.Close()

	for {
		conn, err := l.Accept()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error accepting connection: %s\n", err)
			continue
		}
		go handleConnection(conn)
	}
}

func handleConnection(conn net.Conn) {
	defer conn.Close()
	// TODO: Step 2 - Respond to PING
}

