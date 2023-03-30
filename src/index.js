const { Bitbucket } = require("bitbucket");

const BRANCH_NAME = 'redocly-update';
const COMMIT_AUTHOR = 'Redocly <bot@redocly.com>';
const COMMIT_MESSAGE = 'Updated dependency';

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
async function checkoutBranchForUpdate({ commit, branch = BRANCH_NAME }) {
  await bitbucket.repositories.createBranch({
    ...repositoryDetails,
    _body: {
      name: branch,
      target: {
        hash: commit,
      }
    }
  });

  return true;
}

async function commitChanges({ branch, path, content }) {
  const { data } = await bitbucket.repositories.createSrcFileCommit({
    ...repositoryDetails,
    _body: {
      [path]: content,
    },
    message: COMMIT_MESSAGE,
    author: COMMIT_AUTHOR,
    branch,
  });

  return data;
}

async function createPr(sourceBranch, destinationBranch) {
  const { data } = await bitbucket.pullrequests.create({
    ...repositoryDetails,
    _body: {
      title: 'Redocly dependency update',
      source: {
        branch: {
          name: sourceBranch,
        }
      },
      destination: {
        branch: {
          name: destinationBranch,
        }
      }
    }
  });

  return data;
}

// TODO: handle bad credentials

async function main() {
  const commit = await getMainBranchCommitHash();
  console.log(`Main branch latest commit - ${commit}`);

  const packageJsonContent = await getPackageJsonContent({ commit });

  console.log('The content of existing package.json');
  console.log(packageJsonContent);

  const version = getDependencyVersion(packageJsonContent);

  if (!version) {
    console.log('The dependency was not found. Nothing to update');
    return;
  }

  // TODO: we may not need to update this at all
  console.log(`Found "${PACKAGE_NAME}": "${version}". Desired version is ${PACKAGE_VERSION}`);

  const updatedPackageJson = updateDependencyVersion(packageJsonContent, PACKAGE_VERSION);

  console.log('Updated package.json');
  console.log(updatedPackageJson);

  console.log(`Checkout a new branch '${BRANCH_NAME}' for the update...`);
  await checkoutBranchForUpdate({ branch: BRANCH_NAME, commit });

  console.log('Committing new changes...');

  await commitChanges({
    branch: BRANCH_NAME,
    path: PACKAGE_JSON_PATH,
    content: updatedPackageJson,
  });

  console.log('Creating a new PR...');

  const data = await createPr('main', BRANCH_NAME);

  console.log('Done 🚀');
}

main();
