package main

import (
    "context"
    "encoding/json"
    "net/http"
    "os"

    "github.com/aws/aws-lambda-go/lambda"
)

func HandleRequest(ctx context.Context) (map[string]interface{}, error) {
    token := os.Getenv("GITHUB_API_TOKEN")

    url := "https://api.github.com/repos/dagger/dagger/issues"
    req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
    req.Header.Set("Accept", "application/vnd.github+json")
    req.Header.Set("Authorization", "Bearer "+token)

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        return nil, err
    }

    defer resp.Body.Close()

    res := map[string]interface{}{}
    err = json.NewDecoder(resp.Body).Decode(&res)

    return res, err
}

func main() {
    lambda.Start(HandleRequest)
}
