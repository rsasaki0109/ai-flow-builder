# Security

## Supported Scope

AI Flow Builder is currently an MVP for local development and trusted single-user deployments. It has no built-in authentication, workspace isolation, RBAC, sharing controls, or multi-tenant security model.

Do not expose the app directly to the public internet without adding an authentication layer and reviewing the deployment configuration.

## Reporting a Vulnerability

Please do not disclose suspected vulnerabilities publicly before maintainers have had a chance to investigate.

Use GitHub private vulnerability reporting if it is enabled for the repository. If it is not available, open a minimal issue asking for a private security contact and avoid including exploit details or secrets in the public issue.

Helpful reports include:

- Affected version or commit.
- Clear reproduction steps.
- Expected and actual behavior.
- Impact assessment.
- Any relevant logs with secrets removed.

## Sensitive Data

Do not share:

- API keys or tokens.
- `.env` files.
- Local database files.
- Full AI prompts or provider responses containing private data.
- Flow inputs or outputs containing private data.

The application redacts configured secret fields from logs, and API keys are server-only. They must not be added to `NEXT_PUBLIC_*` variables.

## AI Provider Privacy

With `AI_PROVIDER=disabled`, the app does not call an external AI provider. With `AI_PROVIDER=fake`, AI behavior is local and deterministic.

With `AI_PROVIDER=openai`, flow-generation prompts and AI node prompts are sent to the configured provider. Review your provider agreement and data handling requirements before using AI features with sensitive information.

## Design Constraints

The MVP intentionally avoids arbitrary code execution and external request nodes:

- No JavaScript execution node.
- No Python execution node.
- No shell execution node.
- No HTTP request node.
- No database query node.
- No file system operation node.
- No browser automation node.
- No MCP or agent tool node.

Generated TypeScript is displayed, copied, or downloaded only. The app does not execute generated code.
