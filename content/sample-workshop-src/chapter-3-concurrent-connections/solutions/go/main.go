package main

import (
	"bufio"
	"fmt"
	"io"
	"net"
	"os"
	"strings"
	"time"
)

func handleConnection(c net.Conn) {
	defer c.Close()
	reader := bufio.NewReader(c)

	for {
		c.SetReadDeadline(time.Now().Add(10 * time.Second))

		reqLine, err := reader.ReadString('\n')
		if err != nil {
			if err != io.EOF {
				// Read timeout or connection reset
			}
			break
		}

		parts := strings.Fields(strings.TrimSpace(reqLine))
		if len(parts) < 3 {
			c.Write([]byte("HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n"))
			break
		}

		headers := make(map[string]string)
		for {
			line, err := reader.ReadString('\n')
			if err != nil || strings.TrimSpace(line) == "" {
				break
			}
			hParts := strings.SplitN(strings.TrimSpace(line), ":", 2)
			if len(hParts) == 2 {
				headers[strings.ToLower(strings.TrimSpace(hParts[0]))] = strings.TrimSpace(hParts[1])
			}
		}

		closeConnection := strings.ToLower(headers["connection"]) == "close"

		var resp string
		if parts[1] == "/" {
			resp = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: keep-alive\r\n\r\n"
		} else {
			resp = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n"
		}

		c.Write([]byte(resp))

		if closeConnection {
			break
		}
	}
}

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
		go handleConnection(conn)
	}
}
