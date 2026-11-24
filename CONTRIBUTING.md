# Contributing

Use Node 22.19 or later in the 22.x series, or Node 24. Run these checks from the repository root.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

For changes to session handling or composer interactions, follow the disposable-profile browser scenario in the README. Use synthetic conversations for fixtures and screenshots. Include the DSH version, the checks run and any new limitations in your pull request.

Keep changes scoped to one issue. Add a regression test for a behavior fix. Leave generated lib files, dependencies and tarballs out of commits. Report security issues using the private reporting guidance in [SECURITY.md](SECURITY.md).
