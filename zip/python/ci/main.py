import sys
import os
import anyio
import dagger

async def main():
    # check for required variables in host environment
    for var in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GITHUB_API_TOKEN"]:
        if var not in os.environ:
            raise EnvironmentError('"%s" environment variable must be set' % var)

    async with dagger.Connection(dagger.Config(log_output=sys.stderr)) as client:

        # set client secrets
        aws_access_key_id = client.set_secret("aws_access_key_id", os.environ.get("AWS_ACCESS_KEY_ID"))
        aws_secret_access_key = client.set_secret("aws_secret_access_key", os.environ.get("AWS_SECRET_ACCESS_KEY"))
        github_api_token = client.set_secret("github_api_token", os.environ.get("GITHUB_API_TOKEN"))

        # get host directory
        lambda_file = client.host().directory(".", exclude=["ci"])

        # zip function
        build = (
            client.container()
            .from_("python:3.11-alpine")
            .with_exec(["apk", "add", "zip"])
            .with_directory("/src", lambda_file)
            .with_workdir("/src")
            .with_exec(["pip", "install", "--target", "./packages", "-r", "requirements.txt"])
            .with_workdir("/src/packages")
            .with_exec(["zip", "-r", "../function.zip", "."])
            .with_workdir("/src")
            .with_exec(["zip", "function.zip", "lambda_function.py"])
        )

        # deploy function
        deploy = (
            client.container()
            .from_("alpine:3.17.3")
            .with_exec(["apk", "add", "aws-cli"])
            .with_secret_variable("AWS_ACCESS_KEY_ID", aws_access_key_id)
            .with_secret_variable("AWS_SECRET_ACCESS_KEY", aws_secret_access_key)
            .with_secret_variable("GITHUB_API_TOKEN", github_api_token)
            .with_file("/tmp/function.zip", build.file("/src/function.zip"))
            .with_exec(["sh", "-c", "aws lambda update-function-code --function-name myFunctionPyZip --zip-file fileb:///tmp/function.zip --region us-east-1"])
            .with_exec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionPyZip --handler lambda_function.lambda_handler --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])
        )

        await deploy.exit_code()

anyio.run(main)
