# Bitbucket package.json updater

## Task requirements
- node.js script, which is run manually
- it accepts:
  - the name of the package
  - its version
  - repository details
- it should create a PR of the version of the dependency differs

## Installation process
1. Get a repository Access Token. [Instructions](https://support.atlassian.com/bitbucket-cloud/docs/create-a-repository-access-token/)
2. Make sure, you have enabled an ability to create PRs
3. Make a copy of `.env.sample`
    ```sh
    cp .env.sample .env
    ```
4. Fill the gaps in `.env` file
5. Install the dependencies
    ``` sh
    asdf install
    npm install
    ```
6. Run the application
    ```sh
    npm start
    ```
