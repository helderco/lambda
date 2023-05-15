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
  let githubApiToken = client.setSecret("githubApiToken", process.env["GITHUB_API_TOKEN"])

  let lambdaFile = client.host().directory(".", {exclude:["ci", "node_modules"]})

  let build = client.container()
    .from("node:18-alpine")
    .withDirectory("/src", lambdaFile)
    .withWorkdir("/src")
    .withExec(["npm", "install"])

  let out = await client.container()
    .from("public.ecr.aws/lambda/nodejs:18")
    .withDirectory("/var/task", build.directory("/src"))
    .withEntrypoint(["/lambda-entrypoint.sh", "index.handler"])
    .publish(address)

  await client.container()
    .from("alpine:3.17.3")
    .withExec(["apk", "add", "aws-cli"])
    .withSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId)
    .withSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey)
    .withSecretVariable("GITHUB_API_TOKEN", githubApiToken)
    .withExec(["sh", "-c", `aws lambda update-function-code --function-name myFunctionNodeCtr --image-uri ${out} --region us-east-1`])
    .withExec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionNodeCtr --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])
    .exitCode()

}, {LogOutput: process.stderr})
