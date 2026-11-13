# `@bazion/forms`

Tenant-neutral form submission rules shared by public site templates and the API. The package validates website enquiry payloads and tenant privacy policy input, matches form consent to the published notice version, assigns the server-side consent timestamp and retention deadline, and classifies honeypot submissions. It has no database or web framework dependency.

The current default is 180 days. Tenants should confirm an appropriate retention schedule for their purpose and obligations before enabling public enquiry collection. The API deletes expired records only when the scheduled retention command is run.
