using './main.bicep'

param appName = 'sharemd'
param githubRepo = 'owner/repo'

// Secrets — supply via CLI or pipeline:
//   az deployment group create ... \
//     --parameters githubClientId='xxx' githubClientSecret='xxx' authSecret='xxx'
param githubClientId = ''
param githubClientSecret = ''
param authSecret = ''
