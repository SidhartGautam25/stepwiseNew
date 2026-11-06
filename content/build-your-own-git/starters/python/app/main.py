import sys
import os

def main():
    if len(sys.argv) < 2:
        print("usage: your_git <command> [<args>...]", file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    if command == "init":
        os.makedirs(".git/objects", exist_ok=True)
        os.makedirs(".git/refs/heads", exist_ok=True)
        with open(".git/HEAD", "w") as f:
            f.write("ref: refs/heads/main\n")
        print("Initialized empty Git repository")
    else:
        print(f"Unknown command {command}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

