# ADR 0003: Payment provider adapter and server-confirmed payment state

- Status: Accepted for initial platform
- Date: 2026-11-05

## Decision

Commerce domain/application code depends on a Bazion payment-provider port. Provider SDKs and credentials stay in adapters. Payment success is applied only after a cryptographically authenticated, provider-originated server event and reconciliation of order reference, amount and currency. Browser redirects are presentation only. The included mock adapter is development-only.
