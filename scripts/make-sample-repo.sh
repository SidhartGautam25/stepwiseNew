#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="${1:-content/sample-workshop-repo}"
SRC_DIR="content/sample-workshop-src"

echo "=== Initializing sample workshop Git repository in ${TARGET_DIR} ==="

rm -rf "${TARGET_DIR}"
mkdir -p "${TARGET_DIR}"

cd "${TARGET_DIR}"
git init -b main
git config user.name "Handrail Author"
git config user.email "author@handrail.dev"

# 1. Main branch
echo "Creating main branch..."
cd - > /dev/null
cp -r "${SRC_DIR}/main/"* "${TARGET_DIR}/"

cd "${TARGET_DIR}"
git add .
git commit -m "feat: initial workshop commit on main"

# 2. Chapter 1: bind-port
echo "Creating chapter/bind-port branch..."
git checkout -b chapter/bind-port
cd - > /dev/null
cp -r "${SRC_DIR}/chapter-1-bind-port/"* "${TARGET_DIR}/"

cd "${TARGET_DIR}"
git add .
git commit -m "feat(chapter): bind-port"

# 3. Chapter 2: parse-request
echo "Creating chapter/parse-request branch..."
git checkout -b chapter/parse-request
cd - > /dev/null
cp -r "${SRC_DIR}/chapter-2-parse-request/"* "${TARGET_DIR}/"

cd "${TARGET_DIR}"
git add .
git commit -m "feat(chapter): parse-request"

# 4. Chapter 3: concurrent-connections
echo "Creating chapter/concurrent-connections branch..."
git checkout -b chapter/concurrent-connections
cd - > /dev/null
cp -r "${SRC_DIR}/chapter-3-concurrent-connections/"* "${TARGET_DIR}/"

cd "${TARGET_DIR}"
git add .
git commit -m "feat(chapter): concurrent-connections"

# Checkout main branch
git checkout main

echo "=== Sample workshop Git repository created successfully at ${TARGET_DIR}! ==="
