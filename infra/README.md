# CampusEvac AWS Scaffold

This package is the smallest deployable boundary for the CampusEvac target path. It creates:

- AppSync GraphQL with Cognito user-pool authorization.
- DynamoDB metadata, ordered event, and AAR storage.
- Lambda resolvers for room commands, AAR calculation, scenario proposals, and short phrases.
- Bedrock validation with the authored scenario fallback.
- Polly-to-S3 phrase caching with caption-preserving fallback.

The browser still defaults to `MockNet`. The AppSync browser adapter should only be enabled after
the deployed Cognito client and realtime subscription transport are configured. The active room
worker remains a separate migration gate; Lambda does not pretend to be a persistent 30 Hz loop.

## Commands

```bash
npm install
npm run build
npm run synth
npm run deploy
```

Use an AWS profile, SSO session, or deployment role. Do not place long-lived credentials in the
repository, browser variables, or `.env.example`.
