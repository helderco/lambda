import { connect } from "@dagger.io/dagger"

const functionName = "myFunctionNodeZip";
const functionRegion = "us-east-1";

const vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];
vars.forEach(v => {
  if(!process.env[v]) {
    console.log(`${v} variable must be set`);
    process.exit();
  }
});

connect(async (client) => {

  let awsAccessKeyId = client.setSecret("awsAccessKeyId", process.env["AWS_ACCESS_KEY_ID"])
  let awsSecretAccessKey = client.setSecret("awsSecretAccessKey", process.env["AWS_SECRET_ACCESS_KEY"])
  //let githubApiToken = client.setSecret("githubApiToken", process.env["GITHUB_API_TOKEN"])

  let lambdaDir = client.host().directory(".", {exclude:["ci", "node_modules"]})

  let build = client.container()
      .from("node:18-alpine")
      .withExec(["apk", "add", "zip"])
      .withDirectory("/src", lambdaDir)
      .withWorkdir("/src")
      .withExec(["npm", "install"])
      .withExec(["zip", "-r", "function.zip", "."])

  let deploy = client.container()
      .from("alpine:3.17.3")
      .withExec(["apk", "add", "aws-cli"])
      .withSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId)
      .withSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey)
      //.withSecretVariable("GITHUB_API_TOKEN", githubApiToken)
      .withEnvVariable("CACHE_BUSTER", Date.now().toString())
      .withFile("/tmp/function.zip", build.file("/src/function.zip"))
      .withExec(["sh", "-c", `aws lambda update-function-code --function-name ${functionName} --zip-file fileb:///tmp/function.zip --region ${functionRegion}`])
      .withExec(["sh", "-c", `aws lambda update-function-configuration --function-name ${functionName} --handler lambda.handler --region ${functionRegion}`])
      //.withExec(["sh", "-c", "aws lambda update-function-configuration --function-name myFunctionNodeZip --handler lambda.handler --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"])

  await deploy.exitCode()


}, {LogOutput: process.stderr})
