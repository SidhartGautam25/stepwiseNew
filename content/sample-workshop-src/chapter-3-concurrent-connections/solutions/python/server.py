import socket
import threading
import sys

def handle_client(conn):
    conn.settimeout(10.0)
    try:
        buffer = ""
        while True:
            try:
                data = conn.recv(4096).decode('utf-8')
                if not data:
                    break
                buffer += data

                while "\r\n\r\n" in buffer:
                    header_part, buffer = buffer.split("\r\n\r\n", 1)
                    lines = header_part.split("\r\n")
                    req_line = lines[0].split()
                    if len(req_line) < 3:
                        conn.sendall(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                        return

                    headers = {}
                    for line in lines[1:]:
                        if ":" in line:
                            k, v = line.split(":", 1)
                            headers[k.strip().lower()] = v.strip()

                    should_close = headers.get("connection", "").lower() == "close"

                    if req_line[1] == "/":
                        conn.sendall(b"HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: keep-alive\r\n\r\n")
                    else:
                        conn.sendall(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n")

                    if should_close:
                        return
            except socket.timeout:
                break
    finally:
        conn.close()

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("0.0.0.0", 4221))
    s.listen(10)

    while True:
        conn, _ = s.accept()
        t = threading.Thread(target=handle_client, args=(conn,))
        t.daemon = True
        t.start()

if __name__ == "__main__":
    main()
