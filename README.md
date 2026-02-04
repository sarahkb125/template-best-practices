# Railway Template Validator

A web application that validates Railway templates against the [official best practices guide](https://docs.railway.com/guides/templates-best-practices). Deploy it to Railway or run locally to check if your templates follow Railway's recommendations.

## Features

- **Comprehensive Validation**: Checks 8 core best practice categories
- **Severity Levels**: Distinguishes between errors, warnings, and informational messages
- **Railway Branding**: Styled with Railway's official design system
- **GitHub Integration**: Fetches template configurations directly from repositories
- **Railway API Integration**: Enriches data with icons, descriptions, and metadata

## Validation Categories

### General Best Practices

#### 1. Service Icons
- **Rule**: Services should have icon URLs configured
- **Checks**:
  - Icon field presence in service configuration
  - 1:1 aspect ratio (square icons)
  - Transparent backgrounds recommended
- **Severity**: Warning if missing

#### 2. Naming Conventions
- **Rule**: Names should follow capital case, avoid special characters
- **Checks**:
  - Capital case formatting (e.g., "My Service")
  - No special characters or excessive dashes
  - Space-delimited preferred over hyphenated
  - Reasonable length (2-50 characters)
  - **Exception**: Skips capital case check if name matches GitHub org/company name
- **Severity**: Warning

#### 3. Environment Variables
- **Rule**: Variables should have descriptions and use secure generation
- **Checks**:
  - User-facing variables have descriptions
  - No hardcoded credentials
  - Use of template functions (`${{secret()}}`, `${{randomString()}}`)
  - Use of reference variables (`${{SERVICE.VAR_NAME}}`)
  - **Smart Detection**: Distinguishes user-facing vs internal/system variables
- **Severity**:
  - Error for weak/hardcoded passwords
  - Warning for missing descriptions on user-facing variables
  - Info for pre-configured system values

#### 4. Health Checks
- **Rule**: Web services should have health check endpoints
- **Checks**:
  - `healthcheckPath` field in Railway config
  - `HEALTHCHECK` instruction in Dockerfile
  - Proper endpoint format (starts with `/`)
  - **Smart Detection**: Excludes databases (Redis, Postgres, MySQL, MongoDB, etc.)
- **Severity**: Warning if missing

#### 5. Authentication
- **Rule**: Credentials should use template functions, never hardcoded
- **Checks**:
  - Password/secret variables use `${{secret()}}` or `${{randomString()}}`
  - No weak default passwords (admin, password123, changeme, etc.)
  - Proper credential generation for auth-capable services
- **Severity**:
  - Error for weak defaults
  - Warning for hardcoded values

#### 6. Workspace Naming
- **Rule**: Only use authorized brand/company names
- **Checks**:
  - Unauthorized use of "Railway" in workspace names
  - Use of major brand names without authorization
  - Official Railway workspaces are whitelisted
- **Severity**: Warning

### Technical Infrastructure

#### 7. Private Networking
- **Rule**: Use Railway's private networking for service-to-service communication
- **Checks**:
  - Use of `${{SERVICE.RAILWAY_PRIVATE_DOMAIN}}` for internal URLs
  - Detection of localhost/public URLs that should be private
  - Hardcoded hostnames in connection strings
- **Severity**: Warning
- **Benefits**: Faster communication, reduced costs

#### 8. Persistent Storage
- **Rule**: Databases need persistent volumes to prevent data loss
- **Checks**:
  - Volume configuration for stateful services
  - Correct mount paths for databases:
    - Redis: `/data`
    - PostgreSQL: `/var/lib/postgresql/data`
    - MySQL: `/var/lib/mysql`
    - MongoDB: `/data/db`
- **Severity**: Error if database lacks volumes
- **Applies to**: PostgreSQL, MySQL, MongoDB, Redis, Elasticsearch, and other stateful services

## Usage

### Web Interface

1. Visit the deployed app
2. Enter a Railway template URL or code:
   - Full URL: `railway.com/deploy/redis`
   - Template code: `redis`
3. Click "Validate Template"
4. Review results organized by category

### API Validation

The validator fetches templates using:
1. **Railway GraphQL API**: Template metadata, service icons, descriptions
2. **GitHub API**: railway.json/toml configuration files, Dockerfiles

## Scoring System

- **Overall Score**: Percentage of rules passed
- **Pass**: All checks for a rule succeed
- **Fail**: One or more checks fail with errors
- **Warning**: Non-critical issues that should be addressed

### Score Interpretation
- **80-100%**: Excellent - follows best practices
- **50-79%**: Good - minor improvements needed
- **0-49%**: Needs work - several issues to address

## Examples

### ✅ Good Template (redis)
```
✓ Service Icons - Icon configured
✓ Naming Conventions - "Redis" follows best practices
✓ Private Networking - Uses Railway private domains
✓ Environment Variables - All variables properly configured
✓ Health Checks - Not required for database
✓ Persistent Storage - Volume mounted at /data
✓ Authentication - Password uses ${{secret()}}
✓ Workspace Naming - Official Railway workspace
```

### ⚠️ Needs Improvement
```
⚠ Naming Conventions - Service name "my-api-service" uses dashes
⚠ Environment Variables - API_KEY missing description
⚠ Health Checks - Web service missing healthcheck endpoint
✗ Persistent Storage - PostgreSQL database has no volume configured
✗ Authentication - PASSWORD has weak default value "admin"
```

## Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
npm start

# Development mode with auto-reload
npm run dev
```

### Environment Variables
```bash
# Optional: Increase GitHub API rate limits
GITHUB_TOKEN=ghp_xxxxxxxxxxxxx

# Optional: Railway API access
RAILWAY_API_TOKEN=xxxxxxxxxxxxx
```

### Project Structure
```
src/
├── validators/          # Individual validation rules
│   ├── icons.validator.ts
│   ├── naming.validator.ts
│   ├── network.validator.ts
│   ├── env-vars.validator.ts
│   ├── health.validator.ts
│   ├── storage.validator.ts
│   ├── auth.validator.ts
│   ├── workspace.validator.ts
│   └── validator-engine.ts
├── fetchers/           # Data fetching from APIs
│   ├── railway-api.ts
│   ├── github-fetcher.ts
│   └── url-parser.ts
├── types/              # TypeScript type definitions
└── index.ts            # Express server
```

## Deployment

Deploy to Railway:
```bash
# Push to GitHub
git push origin main

# Railway will auto-deploy using nixpacks.toml configuration
```

### Railway Configuration (nixpacks.toml)
```toml
[phases.setup]
nixPkgs = ["nodejs-18_x"]

[phases.install]
cmds = ["npm ci"]

[phases.build]
cmds = ["npm run build"]

[start]
cmd = "npm start"
```

## Contributing

This validator is designed to help template creators follow Railway's best practices. If you find issues or have suggestions:

1. Check the [Railway Best Practices Guide](https://docs.railway.com/guides/templates-best-practices)
2. Open an issue with details
3. Submit a PR with improvements

## Acknowledgments

- Built for [Railway](https://railway.com)
- Validates against official [Template Best Practices](https://docs.railway.com/guides/templates-best-practices)
- Uses Railway's [Design System](https://railway.com/design)

## License

MIT
