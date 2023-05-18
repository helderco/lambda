import { connect } from "@dagger.io/dagger"

const functionName = "myFunctionNodeCtr";
const functionRegion = "us-east-1";

const vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_ECR_USERNAME", "AWS_ECR_PASSWORD", "AWS_ECR_ADDRESS", "AWS_ECR_IMAGE"];
vars.forEach(v => {
  if(!process.env[v]) {
    console.log(`${v} variable must be set`);
    process.exit();
  }
});

connect(async (client) => {

  let awsAccessKeyId = client.setSecret("awsAccessKeyId", process.env["AWS_ACCESS_KEY_ID"])
  let awsSecretAccessKey = client.setSecret("awsSecretAccessKey", process.env["AWS_SECRET_ACCESS_KEY"])
  let awsEcrPassword = client.setSecret("awsEcrPassword", process.env["AWS_ECR_PASSWORD"])
  let awsEcrUsername = process.env["AWS_ECR_USERNAME"]
  let awsEcrAddress = process.env["AWS_ECR_ADDRESS"]
  let awsEcrImage = process.env["AWS_ECR_IMAGE"]

  let lambdaDir = client.host().directory(".", {exclude:["ci", "node_modules"]})

  // using AWS base image
  /* works
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
    .publish(registryAddress)
    */

  /* using non-AWS base image */
  let build = client.container()
    .from("node:18-buster")
    .withExec(["apt-get", "update"])
    .withExec(["apt-get", "install", "-y", "g++", "make", "cmake", "unzip", "libcurl4-openssl-dev"])
    .withDirectory("/src", lambdaDir)
    .withWorkdir("/src")
    .withExec(["npm", "install", "aws-lambda-ric"])
    .withExec(["npm", "install"])

  await client.container()
    .from("node:18-buster-slim")
    .withDirectory("/src", build.directory("/src"))
    .withWorkdir("/src")
    .withEnvVariable("NPM_CONFIG_CACHE", "/tmp/.npm")
    .withEntrypoint(["/usr/local/bin/npx", "aws-lambda-ric", "lambda.handler"])
    .withRegistryAuth(awsEcrAddress, awsEcrUsername, awsEcrPassword)
    .publish(`${awsEcrAddress}/${awsEcrImage}`)

  await client.container()
    .from("alpine:3.17.3")
    .withExec(["apk", "add", "aws-cli"])
    .withSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId)
    .withSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey)
    .withEnvVariable("CACHE_BUSTER", Date.now().toString())
    .withExec(["sh", "-c", `aws lambda update-function-code --function-name ${functionName} --image-uri ${awsEcrAddress}/${awsEcrImage} --region ${functionRegion}`])
    //.withExec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionNodeCtr --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])
    .exitCode()

}, {LogOutput: process.stderr})
