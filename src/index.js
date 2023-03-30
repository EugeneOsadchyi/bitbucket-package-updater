const { Bitbucket } = require("bitbucket");

const requiredEnvVariables = [
  "BITBUCKET_TOKEN", "WORKSPACE_NAME", "REPOSITORY_NAME", "TARGET_BRANCH",
  "PACKAGE_NAME", "PACKAGE_VERSION",
];

for (env of requiredEnvVariables) {
  if (!process.env[env]) throw new Error(`${env} was not provided`);
}

const BITBUCKET_TOKEN = process.env.BITBUCKET_TOKEN;

const PACKAGE_JSON_PATH = process.env.PACKAGE_JSON_PATH || 'package.json';
const PACKAGE_NAME = process.env.PACKAGE_NAME;
const PACKAGE_VERSION = process.env.PACKAGE_VERSION;

const repositoryDetails = {
  workspace: process.env.WORKSPACE_NAME,
  repo_slug: process.env.REPOSITORY_NAME,
}

const bitbucket = new Bitbucket({
  auth: {
   token: BITBUCKET_TOKEN,
  }
});

// 1. Check if package.json exists in the PACKAGE_JSON_PATH
// 2. Checkout the content of package.json
// 3. Check, whether it contains the package we would like to update.
//    If not - print to the output
//    IF yes - check, if the version should be updated
// 4. Build the updated version of the file
// 5. Create a new branch with the updated version
// 6. Create a new PR for the update

// TODO:
// 1. PR may be already opened. Maybe we need to update it with a new code, if a new version is shipped
// 2. Rebasing the PR
// 3. Maybe user updated the code in a different commit and our PR is not required anymore
// 4. Check PACKAGE_VERSION format
// 5. User can have only major version or major + minor specified, but we have the latest one with a patch (major.minor.patch)


async function getMainBranchCommitHash() {
  const { data: { commit: { hash } } } = await bitbucket.repositories.readSrcRoot({ ...repositoryDetails, format: 'meta' });
  return hash;
}

async function getPackageJsonContent({ path = PACKAGE_JSON_PATH, commit }) {
  const { data: raw } = await bitbucket.repositories.readSrc({
    ...repositoryDetails,
    commit,
    path
  });

  return raw
}

function getDependencyVersion(packageJsonContent) {
  const regexp = `"${PACKAGE_NAME}":\\s*"(.*?)"`;
  const match = packageJsonContent.match(new RegExp(regexp, 'm'));
  return match?.[1];
}

function updateDependencyVersion(packageJsonContent) {
  const regexp = `("${PACKAGE_NAME}":\\s*)".*?"`;

  return packageJsonContent.replace(
    new RegExp(regexp, 'm'), `$1"${PACKAGE_VERSION}"`
  ) || packageJsonContent;
}

// TODO: something here. Maybe remove the old one
async function checkoutBranchForUpdate({ commit, branсh = "redocly-update" }) {
  await bitbucket.repositories.createBranch({
    ...repositoryDetails,
    _body: {
      name: branсh,
      target: {
        hash: commit,
      }
    }
  });

  return true;
}

async function commitChanges({ branch, path, content }) {
  const { data } = await bitbucket.source.createFileCommit({
    ...repositoryDetails,
    _body: {
      [path]: content,
    },
    branch,
    message: 'Updated dependency',
    author: 'Redocly <bot@redocly.com>'
  });

  return data;
}


// TODO: handle bad credentials
getMainBranchCommitHash()
  .then(commit => {
    console.log(`Main branch latest commit - ${commit}`);

    return getPackageJsonContent({ commit })
      .then(content => {
        console.log('The content of existing package.json');
        console.log(content);

        const version = getDependencyVersion(content);

        if (!version) {
          console.log('The dependency was not found. Nothing to update');
          return;
        }

        // TODO: we may not need to update this at all
        console.log(`Found "${PACKAGE_NAME}": "${version}". Desired version is ${PACKAGE_VERSION}`);

        const updatedPackageJson = updateDependencyVersion(content, PACKAGE_VERSION);

        console.log('Updated package.json');
        console.log(updatedPackageJson);

        console.log('Checkout a new branch `redocly-update` for the update...');

        return checkoutBranchForUpdate({ branсh: 'redocly-update', commit })
          .then(() => {
            console.log('Committing new changes...');

            commitChanges({
              branсh: 'redocly-update',
              path: PACKAGE_JSON_PATH,
              content: updatedPackageJson
            });
          });
      });
  });

