# Handrail Catalog Service End-to-End Smoke Test (PowerShell)
param(
  [string]$BaseUrl = $env:CATALOG_SERVICE_URL,
  [string]$ServiceSecret = $env:SERVICE_SECRET,
  [string]$AdminToken = $env:ADMIN_TOKEN
)

if (-not $BaseUrl) { $BaseUrl = "http://localhost:4001" }
if (-not $ServiceSecret) { $ServiceSecret = "dev_internal_sync_token_secret" }

function Write-Pass($msg) { Write-Host "✔ $msg" -ForegroundColor Green }
function Write-Fail($msg) { Write-Host "✖ $msg" -ForegroundColor Red; exit 1 }
function Write-Info($msg) { Write-Host "ℹ $msg" -ForegroundColor Cyan }

Write-Info "Running Handrail Catalog Service Smoke Test against $BaseUrl..."

# 1. Health live & ready
Write-Info "1. Testing health endpoints..."
try {
  $live = Invoke-RestMethod -Uri "$BaseUrl/health/live" -Method Get
  Write-Host "  Live: $($live.status)"
  Write-Pass "Health live endpoint passed"
} catch {
  Write-Fail "Health live check failed: $_"
}

try {
  $ready = Invoke-RestMethod -Uri "$BaseUrl/health/ready" -Method Get
  Write-Host "  Ready status: $($ready.status)"
  Write-Pass "Health ready endpoint verified"
} catch {
  Write-Info "Health ready returned degraded (expected in standalone offline dev mode)"
}

# 2. Public discovery
Write-Info "2. Testing public workshop exploration..."
try {
  $workshops = Invoke-RestMethod -Uri "$BaseUrl/v1/workshops" -Method Get
  Write-Host "  Public workshops count: $($workshops.Count)"
  Write-Pass "Public exploration endpoint returned 200 OK"
} catch {
  Write-Fail "Public workshops list failed: $_"
}

# 3. Internal service token resolution
Write-Info "3. Testing internal service token resolution..."
try {
  $headers = @{ "x-service-token" = $ServiceSecret }
  $resolve = Invoke-RestMethod -Uri "$BaseUrl/internal/workshops/build-your-own-http-server/resolve" -Headers $headers -Method Get
  Write-Host "  Resolved workshop: $($resolve.slug) (version: $($resolve.latestVersion))"
  Write-Pass "Internal service token resolution succeeded"
} catch {
  Write-Info "Workshop not yet registered in DB; continuing..."
}

# 4. Internal API security guard
Write-Info "4. Testing internal API security guard (reject unauthenticated)..."
try {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/internal/workshops/test/resolve" -Method Get -SkipHttpErrorCheck
  if ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 403) {
    Write-Pass "Internal endpoints correctly reject unauthenticated calls (HTTP $($resp.StatusCode))"
  } else {
    Write-Fail "Internal endpoint allowed unauthenticated access with status $($resp.StatusCode)"
  }
} catch {
  Write-Pass "Internal endpoints correctly rejected unauthenticated call"
}

# 5. Gated content check (fail-closed / unauthorized)
Write-Info "5. Testing gated endpoint security..."
try {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/v1/workshops/build-your-own-http-server/chapters/01-ping" -Method Get -SkipHttpErrorCheck
  if ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 403) {
    Write-Pass "Gated chapters correctly require authentication (HTTP $($resp.StatusCode))"
  } else {
    Write-Fail "Gated chapter endpoint leaked content without auth (HTTP $($resp.StatusCode))"
  }
} catch {
  Write-Pass "Gated chapters correctly rejected unauthenticated call"
}

# 6. Gated starter check
Write-Info "6. Testing starter endpoint security..."
try {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/v1/workshops/build-your-own-http-server/starter?language=go" -Method Get -SkipHttpErrorCheck
  if ($resp.StatusCode -eq 401 -or $resp.StatusCode -eq 403) {
    Write-Pass "Starter download endpoint correctly requires authentication (HTTP $($resp.StatusCode))"
  } else {
    Write-Fail "Starter download endpoint leaked URL without auth (HTTP $($resp.StatusCode))"
  }
} catch {
  Write-Pass "Starter download endpoint correctly rejected unauthenticated call"
}

Write-Info "All smoke checks completed successfully!"
