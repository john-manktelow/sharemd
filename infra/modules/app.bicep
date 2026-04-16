param appName string
param location string
param environmentId string
param containerImage string
param customDomain string
param identityId string
param keyVaultUri string

var kvSecrets = [
  'GITHUB-APP-CLIENT-ID'
  'GITHUB-APP-CLIENT-SECRET'
  'GITHUB-APP-ID'
  'GITHUB-APP-PRIVATE-KEY'
  'AUTH-SECRET'
]

resource containerApp 'Microsoft.App/containerApps@2024-03-01' = {
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
        customDomains: [
          {
            name: customDomain
            bindingType: 'Disabled'
          }
        ]
      }
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
            { name: 'GITHUB_APP_CLIENT_ID', secretRef: 'github-app-client-id' }
            { name: 'GITHUB_APP_CLIENT_SECRET', secretRef: 'github-app-client-secret' }
            { name: 'GITHUB_APP_ID', secretRef: 'github-app-id' }
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
