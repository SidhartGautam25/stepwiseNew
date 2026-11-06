import socket

def main():
    print("Handrail: Starting Redis clone...")

    # TODO: Step 1 - Bind port 6379 and accept TCP connections
    server_socket = socket.create_server(("localhost", 6379), reuse_port=True)

    while True:
        client_connection, client_address = server_socket.accept()
        # TODO: Step 2 - Respond to PING
        client_connection.close()

if __name__ == "__main__":
    main()

