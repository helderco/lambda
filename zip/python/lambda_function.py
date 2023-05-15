import requests
import os

def lambda_handler(event, context):

    token = os.environ.get('GITHUB_API_TOKEN')
    url = 'https://api.github.com/repos/dagger/dagger/issues'
    headers = {'Accept': 'application/vnd.github+json', 'Authorization': f'Bearer {token}'}
    r = requests.get(url, headers=headers)
    return r.json()
