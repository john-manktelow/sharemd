using './main.bicep'

param appName = 'sharemd'
param githubRepo = 'owner/repo'

// Secrets — supply via CLI or pipeline:
//   az deployment group create ... \
//     --parameters githubAppClientId='xxx' githubAppClientSecret='xxx' \
//                  githubAppId='xxx' githubAppPrivateKey="$(cat key.pem | sed ':a;N;$!ba;s/\n/\\n/g')" \
//                  authSecret='xxx'
param githubAppClientId = ''
param githubAppClientSecret = ''
param githubAppId = ''
param githubAppPrivateKey = ''
param authSecret = ''
