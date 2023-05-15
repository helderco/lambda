import { connect } from "@dagger.io/dagger"

const vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GITHUB_API_TOKEN"];
vars.forEach(v => {
  if(!process.env[v]) {
    console.log(`${v} variable must be set`);
    process.exit();
  }
});

connect(async (client) => {

  let awsAccessKeyId = client.setSecret("awsAccessKeyId", process.env["AWS_ACCESS_KEY_ID"])
  let awsSecretAccessKey = client.setSecret("awsSecretAccessKey", process.env["AWS_SECRET_ACCESS_KEY"])
  let githubApiToken = client.setSecret("githubApiToken", process.env["GITHUB_API_TOKEN"])

  let lambdaFile = client.host().directory(".", {exclude:["ci", "node_modules"]})

  let build = client.container()
      .from("node:18-alpine")
      .withExec(["apk", "add", "zip"])
      .withDirectory("/src", lambdaFile)
      .withWorkdir("/src")
      .withExec(["npm", "install"])
      .withExec(["zip", "-r", "function.zip", "."])

  let deploy = client.container()
      .from("alpine:3.17.3")
      .withExec(["apk", "add", "aws-cli"])
      .withSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId)
      .withSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey)
      .withSecretVariable("GITHUB_API_TOKEN", githubApiToken)
      .withFile("/tmp/function.zip", build.file("/src/function.zip"))
      .withExec(["sh", "-c", "aws lambda update-function-code --function-name myFunctionNodeZip --zip-file fileb:///tmp/function.zip --region us-east-1"])
      .withExec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionNodeZip --handler index.handler --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])

  await deploy.exitCode()


}, {LogOutput: process.stderr})
