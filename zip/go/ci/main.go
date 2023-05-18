package main

import (
    "context"
    "os"
		"log"
		"fmt"
		"time"

    "dagger.io/dagger"
)

func main() {

		functionName := "myFunctionGoZip"
		functionRegion := "us-east-1"

		vars := []string{"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"}
		for _, v := range vars {
				if os.Getenv(v) == "" {
						log.Fatalf("Environment variable %s is not set", v)
				}
		}

    // initialize Dagger client
    ctx := context.Background()
    client, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr))
    if err != nil {
        panic(err)
    }
    defer client.Close()

		awsAccessKeyId := client.SetSecret("awsAccessKeyId", os.Getenv("AWS_ACCESS_KEY_ID"))
		awsSecretAccessKey := client.SetSecret("awsSecretAccessKey",  os.Getenv("AWS_SECRET_ACCESS_KEY"))
		//githubApiToken := client.SetSecret("githubApiToken",  os.Getenv("GITHUB_API_TOKEN"))

		lambdaDir := client.Host().Directory(".", dagger.HostDirectoryOpts{
			Exclude: []string{"ci"},
		})

		build := client.Container().
			From("golang:1.20-alpine").
			WithExec([]string{"apk", "add", "zip"}).
			WithDirectory("/src", lambdaDir).
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
			WithEnvVariable("CACHE_BUSTER", time.Now().String()).
			//WithSecretVariable("GITHUB_API_TOKEN", githubApiToken).
			WithFile("/tmp/function.zip", build.File("/src/function.zip")).
			WithExec([]string{"sh", "-c", fmt.Sprintf("aws lambda update-function-code --function-name %s --zip-file fileb:///tmp/function.zip --region %s", functionName, functionRegion)}).
			WithExec([]string{"sh", "-c", fmt.Sprintf("aws lambda update-function-configuration --function-name %s --handler lambda --region %s", functionName, functionRegion)}).
			ExitCode(ctx)
		if err != nil {
        panic(err)
    }

}
