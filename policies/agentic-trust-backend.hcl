# Dynamic Couchbase creds for missions
path "database/creds/couchbase-missions" {
  capabilities = ["read"]
}

# Lease management for those creds
path "sys/leases/renew" {
  capabilities = ["update"]
}

path "sys/leases/revoke" {
  capabilities = ["update"]
}

# KV v2: JWT secret and password pepper
path "kv/data/app/agentic_auth" {
  capabilities = ["read"]
}

# Transit for mission and PII
path "transit/encrypt/*" {
  capabilities = ["update"]
}
path "transit/decrypt/*" {
  capabilities = ["update"]
}

# Transform encode for emails
path "transform/encode/agentic-email" {
  capabilities = ["update"]
}

# Optional: decode, only if this app should be able to recover real emails
path "transform/decode/agentic-email" {
  capabilities = ["update"]
}

# Create child tokens with metadata (for user/mission tracking later)
path "auth/token/create" {
  capabilities = ["update"]
}

# Optional: wrapping and unwrapping
path "sys/wrapping/wrap" {
  capabilities = ["update"]
}
path "sys/wrapping/unwrap" {
  capabilities = ["update"]
}
