package main

import (
    "context"
    "os"
		"fmt"
		"time"
		"log"

    "dagger.io/dagger"
)


func main() {
	vars := []string{"AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "GITHUB_API_TOKEN"}
	for _, v := range vars {
			if os.Getenv(v) == "" {
					log.Fatalf("Environment variable %s is not set", v)
			}
	}

	repository := "791663586286.dkr.ecr.us-east-1.amazonaws.com/vikramtest:latest"

	// initialize Dagger client
	ctx := context.Background()
	client, err := dagger.Connect(ctx, dagger.WithLogOutput(os.Stderr))
	if err != nil {
			panic(err)
	}
	defer client.Close()

	awsAccessKeyId := client.SetSecret("awsAccessKeyId", os.Getenv("AWS_ACCESS_KEY_ID"))
	awsSecretAccessKey := client.SetSecret("awsSecretAccessKey",  os.Getenv("AWS_SECRET_ACCESS_KEY"))

	lambdaDir := client.Host().Directory(".", dagger.HostDirectoryOpts{
		Exclude: []string{"ci"},
	})

	build := client.Container().
		From("golang:1.20-alpine").
		WithDirectory("/src", lambdaDir).
		WithWorkdir("/src").
		WithEnvVariable("GOOS", "linux").
		WithEnvVariable("GOARCH", "amd64").
		WithExec([]string{"go", "build", "-o", "lambda", "lambda.go"})

	/* using aws base image
	deploy := client.Container().
    From("public.ecr.aws/lambda/go:1")

	taskDir, err := deploy.EnvVariable(ctx, "LAMBDA_TASK_ROOT")
	if err != nil {
		panic(err)
	}
	fmt.Printf(taskDir)

	_, err = deploy.
		WithFile("/lambda", build.File("/src/lambda")).
		WithEntrypoint([]string{"/lambda-entrypoint.sh", "lambda"}). // overwrite entrypoint
    Publish(ctx, repository)
  if err != nil {
			panic(err)
	}
	*/

	// using alpine base image
	_, err = client.Container().
    From("golang:1.20-alpine").
		WithFile("/lambda", build.File("/src/lambda")).
		WithEntrypoint([]string{"/lambda"}).
    Publish(ctx, repository)
	if err != nil {
			panic(err)
	}

	_, err = client.Container().
		From("alpine:3.17.3").
		WithExec([]string{"apk", "add", "aws-cli"}).
		WithSecretVariable("AWS_ACCESS_KEY_ID", awsAccessKeyId).
		WithSecretVariable("AWS_SECRET_ACCESS_KEY", awsSecretAccessKey).
    WithEnvVariable("CACHE_BUSTER", time.Now().String()).
		WithExec([]string{"sh", "-c", fmt.Sprintf("aws lambda update-function-code --function-name myFunctionGoCtr --image-uri %s --region us-east-1", repository)}).
		ExitCode(ctx)
	if err != nil {
			panic(err)
	}

}
