# Parse HTTP Request

In this chapter, you will read raw bytes from the client TCP stream and parse them into structured HTTP requests.

## Parse HTTP Request Line {#parse-request-line}

### Task
Read the initial CRLF-terminated line from the stream and parse it into three distinct components: HTTP Method (`GET`), Target Path (`/`), and HTTP Version (`HTTP/1.1`). Respond with `HTTP/1.1 200 OK\r\n\r\n` for valid GET requests to `/`.

### Theory
According to RFC 7230, every HTTP request starts with a Request Line formatted as: `Method SP Request-Target SP HTTP-Version CRLF`. For example: `GET /index.html HTTP/1.1\r\n`.

### Hints
Read data from the connection until you encounter `\r\n`. Split the line by spaces (` `) to extract the three elements.

## Parse HTTP Headers {#parse-headers}

### Task
Parse the subsequent header lines until the blank line (`\r\n\r\n`), extracting header names and values (e.g. `Host: localhost:4221`, `User-Agent: curl/7.88`).

### Theory
Headers follow the request line as a sequence of key-value pairs formatted as `Field-Name: OWS Field-Value OWS CRLF`. A blank line containing only `\r\n` signifies the end of the headers section and the start of the optional request body.

### Hints
Iterate through lines following the request line. Split on the first colon (`:`) to separate the case-insensitive field name from its value.
