# Assumptions
- ECR repository exists for container push
- Lambda function exists with public endpoint
- Lambda function env is configured separately (in this case, GITHUB_API_TOKEN env var)

This pipeline is intended only to update an existing lambda. It will fail if the lambda does not already exist.
