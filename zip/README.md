# Assumptions
- Lambda function exists with public endpoint
- Lambda function env is configured separately (in this case, GITHUB_API_TOKEN env var)

Note: This pipeline is intended only to update an existing lambda. It will fail if the lambda does not already exist.

# Usage
Set these env vars on the runner:

```
#!/bin/bash
export AWS_ACCESS_KEY_ID=
export AWS_SECRET_ACCESS_KEY=
```

Set this env var in AWS Lambda:

```
GITHUB_API_TOKEN=
```

Within the CI tool, set the constants `function-name` and `function-region` at the top of each file.
