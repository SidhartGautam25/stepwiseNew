import socket
import sys

def main():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("0.0.0.0", 4221))
        s.listen(5)
    except Exception as e:
        print(f"Failed to bind: {e}", file=sys.stderr)
        sys.exit(1)

    while True:
        conn, _ = s.accept()
        conn.close()

if __name__ == "__main__":
    main()
