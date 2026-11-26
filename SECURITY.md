# Security policy

## Reporting a vulnerability

Do not report exploitable vulnerabilities in public issues. Report privately through either of these channels:

- **Email:** `security@bazionweb.com` (monitored platform security inbox — include reproduction steps and affected components; expect an acknowledgement within 72 hours).
- **GitHub private vulnerability reporting:** Security tab → *Report a vulnerability* on this repository.

Both channels reach the platform owner and the designated security contact directly. When the repository becomes public, keep GitHub private vulnerability reporting enabled and this section updated with the monitored contact.

## Supported versions

Only the current maintained platform branch is supported until a formal release policy is adopted.

## Security expectations

- Never commit `.env`, production credentials, API tokens, payment secrets, private keys or customer data.
- Do not weaken production startup guards for mock payments or static tenant resolution.
- Review dependency and migration changes before merging.
- Run tenant-isolation and payment-webhook tests before a production release.
