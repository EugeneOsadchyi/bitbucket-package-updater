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
// bitbucket.repositories.readSrcRoot({ ...repositoryDetails, format: 'meta' })
//   .then(({ data, headers }) => console.log(JSON.stringify(data, null, 2)))
//   .catch((err) => console.error(err))

async function getPackageJsonContent({ path = PACKAGE_JSON_PATH, commit }) {
  const { data: raw } = await bitbucket.repositories.readSrc({
    ...repositoryDetails,
    commit,
    path
  });

  // TODO: JSON may be corrupted
  return JSON.parse(raw);
}

function getDependencyVersion(packageJsonContent) {
  return packageJsonContent?.dependencies?.[PACKAGE_NAME]
    || packageJsonContent?.devDependencies?.[PACKAGE_NAME];
}

// TODO: think of doing this in a better way. Change this to regexp
function updateDependencyVersion(packageJsonContent, version) {
  if (packageJsonContent?.dependencies?.[PACKAGE_NAME]) {
    return updateDependencyVersionByType(packageJsonContent, 'dependencies', version);
  } else if (packageJsonContent?.devDependencies?.[PACKAGE_NAME]) {
    return updateDependencyVersionByType(packageJsonContent, 'devDependencies', version);
  }
}

function updateDependencyVersionByType(packageJsonContent, dependencyType, version) {
  return {
    ...packageJsonContent,
    [dependencyType]: {
      ...packageJsonContent[dependencyType],
      [PACKAGE_NAME]: version,
    }
  }
}

// bitbucket.repositories.readSrc({ ...repositoryDetails, commit: "54386e6edc4b0cbc481aaef4c2d68e65304892d6", path: '.gitignore' })
//   .then(({ data, headers }) => console.log(data, headers))
//   .catch((err) => console.error(err))


// bitbucket.pullrequests.list({ ...repositoryDetails })
//   .then(({ data, headers }) => console.log(data, headers))
//   .catch((err) => console.error(err))

// bitbucket.repositories.getBranch({ name: 'main', ...repositoryDetails, fields: ['target'] })
//   .then(({ data, headers }) => console.log(data.target.hash))
//   .catch((err) => console.error(JSON.stringify(err, null, 2)))


// TODO: something here. Maybe remove the old one
async function checkoutBranchForUpdate({ commit, branchName = "redocly-update" }) {
  await bitbucket.repositories.createBranch({
    ...repositoryDetails,
    _body: {
      name: branchName,
      target: {
        hash: commit,
      }
    }
  });

  return true;
}

// bitbucket.repositories.createBranch({
//   ...repositoryDetails,
//   _body: {
//     name: "redocly-update",
//     target : {
//       hash : "54386e6edc4b0cbc481aaef4c2d68e65304892d6",
//     }
//   }
// })
//   .then(({ data, headers }) => console.log(JSON.stringify(data, null, 2), headers))
//   .catch((err) => console.error(JSON.stringify(err, null, 2)))

async function commitChanges({ branch, fileName, content }) {
  const { data } = await bitbucket.source.createFileCommit({
    ...repositoryDetails,
    _body: content,
    files: [fileName],
    branch,
    message: 'Updated dependency',
    author: 'Redocly'
  });

  console.log(data);

  return data;
}


// // TODO: handle bad credentials
// getMainBranchCommitHash()
//   .then(commit => {
//     console.log(`Main branch latest commit - ${commit}`);

//     return getPackageJsonContent({ commit })
//       .then(content => {
//         console.log('The content of existing package.json');
//         console.log(content);

//         const version = getDependencyVersion(content);

//         if (!version) {
//           console.log('The dependency was not found. Nothing to update');
//           return;
//         }

//         // TODO: we may not need to update this at all
//         console.log(`Found "${PACKAGE_NAME}": "${version}". Desired version is ${PACKAGE_VERSION}`);

//         const updatedPackageJson = updateDependencyVersion(content, PACKAGE_VERSION);

//         console.log('Updated package.json');
//         console.log(updatedPackageJson);

//         console.log('Checkout a new branch `redocly-update` for the update...');

//         return checkoutBranchForUpdate({ branchName: 'redocly-update', commit })
//           .then(() => {

//           });
//       });
//   });


const content = {
  name: 'sample-node-app',
  version: '1.0.0',
  description: 'Sample App',
  main: 'index.js',
  scripts: { test: 'echo "Error: no test specified" && exit 1' },
  keywords: [],
  author: '',
  license: 'ISC',
  dependencies: { redoc: '2.0.0' }
};

bitbucket.source.createFileCommit({
  ...repositoryDetails,
  _body: {
    'package.json': JSON.stringify(content, null, 2),
  },
  branch: 'redocly-update',
  message: 'Updated dependency',
  author: 'Redocly <bot@redocly.com>'
}).then(console.log()).catch(console.error);
