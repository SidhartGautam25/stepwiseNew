package main

import (
	"fmt"
	"os"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "usage: your_pm <command> [<args>...]\n")
		os.Exit(1)
	}

	command := os.Args[1]
	switch command {
	case "info":
		fmt.Println("Querying npm registry...")
	case "install":
		fmt.Println("Installing packages...")
	default:
		fmt.Fprintf(os.Stderr, "Unknown command %s\n", command)
		os.Exit(1)
	}
}

