package main

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"strings"
)

func main() {
	l, err := net.Listen("tcp", "0.0.0.0:4221")
	if err != nil {
		fmt.Printf("Failed to bind: %v\n", err)
		os.Exit(1)
	}
	defer l.Close()

	for {
		conn, err := l.Accept()
		if err != nil {
			continue
		}

		go func(c net.Conn) {
			defer c.Close()
			reader := bufio.NewReader(c)

			reqLine, err := reader.ReadString('\n')
			if err != nil {
				return
			}
			parts := strings.Fields(strings.TrimSpace(reqLine))
			if len(parts) < 3 {
				c.Write([]byte("HTTP/1.1 400 Bad Request\r\n\r\n"))
				return
			}

			// Read headers until empty line
			for {
				line, err := reader.ReadString('\n')
				if err != nil || strings.TrimSpace(line) == "" {
					break
				}
			}

			if parts[1] == "/" {
				c.Write([]byte("HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"))
			} else {
				c.Write([]byte("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"))
			}
		}(conn)
	}
}
