import socket
import sys

def handle_client(conn):
    try:
        data = conn.recv(4096).decode('utf-8')
        if not data:
            return

        lines = data.split('\r\n')
        req_line = lines[0].split()
        if len(req_line) < 3:
            conn.sendall(b"HTTP/1.1 400 Bad Request\r\n\r\n")
            return

        path = req_line[1]
        if path == "/":
            conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n")
        else:
            conn.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")
    finally:
        conn.close()

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", 4221))
    s.listen(5)

    while True:
        conn, _ = s.accept()
        handle_client(conn)

if __name__ == "__main__":
    main()
