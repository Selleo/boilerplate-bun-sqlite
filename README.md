# Light template

To install dependencies:

```bash
bun install
```

To start a development server:

```bash
bun dev
```

To run for production:

```bash
bun start
```

## Google auth env vars

Set these before running the server:

```bash
export BETTER_AUTH_SECRET="replace-with-a-long-random-secret"
export BETTER_AUTH_URL="http://localhost:3000"
export GOOGLE_CLIENT_ID="your-google-oauth-client-id"
export GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
```

Google OAuth redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

This project was created using `bun init` in bun v1.3.8. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
