# GitHub repository setup

The prepared folder is ready to become a Git repository. Keep it **private initially** because it contains internal platform architecture and local development configuration examples. The `.env.example` file contains development-only placeholder credentials, not production secrets.

## Create the repository

1. In GitHub, create an empty private repository named `bazion-platform` under the Bazion Web organization/account.
2. Do not initialize it with a README, license or `.gitignore`; those files already exist here.
3. From the extracted repository folder, run:

   ```bash
   git init -b main
   git add .
   git commit -m "chore: bootstrap Bazion Web platform"
   git remote add origin https://github.com/BAZION-OWNER/bazion-platform.git
   git push -u origin main
   ```

4. Replace `BAZION-OWNER` with the actual organization or account name.
5. Enable branch protection for `main`: require pull requests, require the CI checks, prevent force-pushes and prevent deletion.
6. Enable Dependabot alerts, dependency graph and secret scanning where available.
7. Once the first local `pnpm install` succeeds, commit `pnpm-lock.yaml` and change CI to `pnpm install --frozen-lockfile`.

## Initial repository rules

- Keep `.env` out of Git; `.gitignore` already excludes it.
- Use GitHub Actions secrets/environment secrets for CI/deployment credentials.
- Require review for changes to migrations, tenant isolation, authentication and payment handling.
- Avoid publishing packages publicly until Bazion has chosen the source-code license and package access model.
