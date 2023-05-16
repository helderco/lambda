package main

import (
    "context"
    "os"

    "dagger.io/dagger"
)

func main() {
    // initialize Dagger client
    ctx := context.Background()
    client, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr))
    if err != nil {
        panic(err)
    }
    defer client.Close()

		awsAccessKeyId := client.SetSecret("awsAccessKeyId", os.Getenv("AWS_ACCESS_KEY_ID"))
		awsSecretAccessKey := client.SetSecret("awsSecretAccessKey",  os.Getenv("AWS_SECRET_ACCESS_KEY"))
		githubApiToken := client.SetSecret("githubApiToken",  os.Getenv("GITHUB_API_TOKEN"))

		lambdaFile := client.Host().Directory(".", dagger.HostDirectoryOpts{
			Exclude: []string{"ci"},
		})

		build := client.Container().
			From("golang:1.20-alpine").
			WithExec([]string{"apk", "add", "zip"}).
			WithDirectory("/src", lambdaFile).
			WithWorkdir("/src").
			WithEnvVariable("GOOS", "linux").
			WithEnvVariable("GOARCH", "amd64").
			WithExec([]string{"go", "build", "-o", "lambda", "lambda.go"}).
			WithExec([]string{"zip", "function.zip", "lambda"})

		_, err = client.Container().
			From("alpine:3.17.3").
			WithExec([]string{"apk", "add", "aws-cli"}).
			WithSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId).
			WithSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey).
			WithSecretVariable("GITHUB_API_TOKEN", githubApiToken).
			WithFile("/tmp/function.zip", build.File("/src/function.zip")).
			WithExec([]string{"sh", "-c", "aws lambda update-function-code --function-name myFunctionGoZip --zip-file fileb:///tmp/function.zip --region us-east-1"}).
			WithExec([]string{"sh", "-c", "aws lambda update-function-configuration --function-name myFunctionGoZip --handler lambda --environment Variables={GITHUB_API_TOKEN=$GITHUB_API_TOKEN} --region us-east-1"}).
			ExitCode(ctx)
		if err != nil {
        panic(err)
    }

}
