# The Sorting Hat

GitHub bot to label stuff.

## Development

```sh
# Install dependencies
npm ci

# Run development environment
npm run dev
```

## Features

-   Labels PRs based on the number of line additions and deletions
    -   Original PR size labeling functionality taken from [Pull Request Size](https://github.com/noqcks/pull-request-size)
    -   Excludes computer generated files as detected in [@noqcks/generated](https://github.com/noqcks/generated). (Full list of files detected here: [generated.js](https://github.com/noqcks/generated/blob/master/lib/generated.js))
    -   Excludes files listed as `linguist-generated=true` or `pr-size-ignore=true` in `.gitattributes`

## Architecture

-   Built with `create-probot-app` from [Probot](https://github.com/probot/probot)

-   Converted to run as GitHub Action instead of App. This means the application does not have to be deployed but can be run as needed by a workflow. Docs for running probot app as a GitHub Action: https://github.com/probot/example-github-action
