# Security policy

## Reporting a vulnerability

Do not report exploitable vulnerabilities in public issues. For a private Bazion-owned repository, report privately to the platform owner or the designated security contact. Before making this repository public, configure GitHub private vulnerability reporting and publish a monitored security contact.

## Supported versions

Only the current maintained platform branch is supported until a formal release policy is adopted.

## Security expectations

- Never commit `.env`, production credentials, API tokens, payment secrets, private keys or customer data.
- Do not weaken production startup guards for mock payments or static tenant resolution.
- Review dependency and migration changes before merging.
- Run tenant-isolation and payment-webhook tests before a production release.
