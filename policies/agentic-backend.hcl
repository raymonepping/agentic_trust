# Read app secrets for JWT and password pepper
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

# Decide carefully about decode - maybe only for a support tool
path "transform/decode/agentic-email" {
  capabilities = ["update"]
}

# Create child tokens with metadata
path "auth/token/create" {
  capabilities = ["update"]
}

# Optional wrapping
path "sys/wrapping/wrap" {
  capabilities = ["update"]
}
path "sys/wrapping/unwrap" {
  capabilities = ["update"]
}
