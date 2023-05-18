import sys
import os
import datetime
import anyio
import dagger

async def main():

    function_name = "myFunctionPyCtr"
    function_region = "us-east-1"

    # check for required variables in host environment
    for var in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ECR_USERNAME", "AWS_ECR_PASSWORD", "AWS_ECR_ADDRESS", "AWS_ECR_IMAGE"]:
        if var not in os.environ:
            raise EnvironmentError('"%s" environment variable must be set' % var)

    async with dagger.Connection(dagger.Config(log_output=sys.stderr)) as client:

        # set client secrets
        aws_access_key_id = client.set_secret("aws_access_key_id", os.environ.get("AWS_ACCESS_KEY_ID"))
        aws_secret_access_key = client.set_secret("aws_secret_access_key", os.environ.get("AWS_SECRET_ACCESS_KEY"))
        aws_ecr_password = client.set_secret("aws_ecr_password", os.environ.get("AWS_ECR_PASSWORD"))
        aws_ecr_username = os.environ.get("AWS_ECR_USERNAME")
        aws_ecr_address = os.environ.get("AWS_ECR_ADDRESS")
        aws_ecr_image = os.environ.get("AWS_ECR_IMAGE")

        # get host directory
        lambda_dir = client.host().directory(".", exclude=["ci", ".venv"])

        build = (
            client.container()
            .from_("python:3.11-buster")
            .with_exec(["apt-get", "update"])
            .with_exec(["apt-get", "install", "-y", "g++", "make", "cmake", "unzip", "libcurl4-openssl-dev"])
            .with_directory("/src", lambda_dir)
            .with_workdir("/src")
            .with_exec(["pip", "install", "--target", ".", "awslambdaric"])
        )

        deploy = (
            client.container()
            .from_("python:3.11-slim-buster")
            .with_directory("/src", build.directory("/src"))
            .with_workdir("/src")
            .with_exec(["pip", "install", "-r", "requirements.txt"])
            .with_entrypoint(["/usr/local/bin/python", "-m", "awslambdaric", "lambda.handler"])
        )

        # using aws base image
        # doesn't work
        # module import error for lambda_function
        #build = (
        #    client.container()
        #    .from_("python:3.10-alpine")
        #    .with_directory("/src", lambda_dir)
        #    .with_workdir("/src")
        #    .with_exec(["pip", "install", "--target", ".", "-r", "requirements.txt"])
        #)

        #deploy = (
        #    client.container()
        #    .from_("public.ecr.aws/lambda/python:3.10")
        #)

        #task_dir = await deploy.env_variable("LAMBDA_TASK_ROOT")

        #deploy = (
        #    deploy
        #    .with_directory(task_dir, build.directory("/src"))
        #    .with_entrypoint(["/lambda-entrypoint.sh", "lambda_function.lambda_handler"])
        #)

        await (
            deploy
            .with_registry_auth(aws_ecr_address, aws_ecr_username, aws_ecr_password)
            .publish(f"{aws_ecr_address}/{aws_ecr_image}")
        )

        # deploy function
        deploy = (
            client.container()
            .from_("alpine:3.17.3")
            .with_exec(["apk", "add", "aws-cli"])
            .with_secret_variable("AWS_ACCESS_KEY_ID", aws_access_key_id)
            .with_secret_variable("AWS_SECRET_ACCESS_KEY", aws_secret_access_key)
            .with_env_variable("CACHE_BUSTER", str(datetime.datetime.utcnow().timestamp()))
            .with_exec(["sh", "-c", f"aws lambda update-function-code --function-name {function_name} --image-uri {aws_ecr_address}/{aws_ecr_image} --region {function_region}"])
        )

        await deploy.exit_code()

anyio.run(main)
