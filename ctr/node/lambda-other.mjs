// can't figure out why but this .mjs file doesn't work in a lambda container
// image
// returns Uncaught Exception {"errorType":"Runtime.ImportModuleError","errorMessage":"Error: Cannot find module 'lambda'
import fetch from 'node-fetch'

export const handler = async(event) => {
    const token = process.env['GITHUB_API_TOKEN'];
    const headers = {'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}`}
    const response = await fetch('https://api.github.com/repos/dagger/dagger/issues', {
	    headers: headers
    });
    const data = await response.json();
    return data;
};
