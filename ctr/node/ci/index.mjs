import { connect } from "@dagger.io/dagger"

const vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GITHUB_API_TOKEN"];
vars.forEach(v => {
  if(!process.env[v]) {
    console.log(`${v} variable must be set`);
    process.exit();
  }
});

const address = '791663586286.dkr.ecr.us-east-1.amazonaws.com/vikramtest:latest';

connect(async (client) => {

  let awsAccessKeyId = client.setSecret("awsAccessKeyId", process.env["AWS_ACCESS_KEY_ID"])
  let awsSecretAccessKey = client.setSecret("awsSecretAccessKey", process.env["AWS_SECRET_ACCESS_KEY"])

  let lambdaDir = client.host().directory(".", {exclude:["ci", "node_modules"]})

  // using AWS base image
  /*
  let build = client.container()
    .from("node:18-alpine")
    .withDirectory("/src", lambdaDir)
    .withWorkdir("/src")
    .withExec(["npm", "install"])

  let deploy = client.container()
    .from("public.ecr.aws/lambda/nodejs:18")

  let taskDir = await deploy
    .envVariable("LAMBDA_TASK_ROOT")

  await deploy
    .withDirectory(taskDir, build.directory("/src"))
    .withEntrypoint(["/lambda-entrypoint.sh", "index.handler"]) // overwrite entrypoint
    .publish(address)
    */

  /* using non-AWS base image */
  let build = client.container()
    .from("node:18-buster")
    .withExec(["apt-get", "update"])
    .withExec(["apt-get", "install", "-y", "g++", "make", "cmake", "unzip", "libcurl4-openssl-dev"])
    .withDirectory("/src", lambdaDir)
    .withWorkdir("/src")
    .withExec(["npm", "install", "aws-lambda-ric"])

  await client.container()
    .from("node:18-buster-slim")
    .withDirectory("/src", build.directory("/src"))
    .withWorkdir("/src")
    .withEnvVariable("NPM_CONFIG_CACHE", "/tmp/.npm")
    .withExec(["npm", "install"])
    .withEntrypoint(["/usr/local/bin/npx", "aws-lambda-ric", "lambda.handler"])
    .publish(address)

  await client.container()
    .from("alpine:3.17.3")
    .withExec(["apk", "add", "aws-cli"])
    .withSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId)
    .withSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey)
    .withEnvVariable("CACHE_BUSTER", Date.now().toString())
    .withExec(["sh", "-c", `aws lambda update-function-code --function-name myFunctionNodeCtr --image-uri ${address} --region us-east-1`])
    //.withExec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionNodeCtr --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])
    .exitCode()

}, {LogOutput: process.stderr})
