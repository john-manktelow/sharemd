param appName string
param location string
param environmentId string
param containerImage string
param customDomain string
param identityId string
param keyVaultUri string
param githubAppClientId string
param githubAppId string

var kvSecrets = [
  'GITHUB-APP-CLIENT-SECRET'
  'GITHUB-APP-PRIVATE-KEY'
  'AUTH-SECRET'
  'GHCR-PAT'
]

// Phase 1: create the app WITHOUT custom domain.
resource containerApp 'Microsoft.App/containerApps@2025-07-01' = {
  name: 'app-${appName}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identityId}': {}
    }
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: 'ghcr.io'
          username: 'john-manktelow'
          passwordSecretRef: 'ghcr-pat'
        }
      ]
      secrets: [for s in kvSecrets: {
        name: toLower(s)
        keyVaultUrl: '${keyVaultUri}secrets/${s}'
        identity: identityId
      }]
    }
    template: {
      containers: [
        {
          image: containerImage
          name: appName
          env: [
            { name: 'NODE_ENV', value: 'production' }
            { name: 'PORT', value: '3000' }
            { name: 'AUTH_TRUST_HOST', value: 'true' }
            { name: 'AUTH_URL', value: 'https://${customDomain}' }
            { name: 'NEXTAUTH_URL', value: 'https://${customDomain}' }
            { name: 'GITHUB_APP_CLIENT_ID', value: githubAppClientId }
            { name: 'GITHUB_APP_CLIENT_SECRET', secretRef: 'github-app-client-secret' }
            { name: 'GITHUB_APP_ID', value: githubAppId }
            { name: 'GITHUB_APP_PRIVATE_KEY', secretRef: 'github-app-private-key' }
            { name: 'AUTH_SECRET', secretRef: 'auth-secret' }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

output fqdn string = containerApp.properties.configuration.ingress.fqdn
output appName string = containerApp.name
output customDomainVerificationId string = containerApp.properties.customDomainVerificationId
