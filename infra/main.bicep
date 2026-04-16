targetScope = 'resourceGroup'

@description('Base name for all resources')
param appName string = 'sharemd'

@description('Azure region')
param location string = resourceGroup().location

@description('GitHub App client ID')
@secure()
param githubAppClientId string

@description('GitHub App client secret')
@secure()
param githubAppClientSecret string

@description('GitHub App numeric ID')
@secure()
param githubAppId string

@description('GitHub App private key (PEM, with newlines escaped as \\n)')
@secure()
param githubAppPrivateKey string

@description('NextAuth secret (random string)')
@secure()
param authSecret string

@description('Target GitHub repo (owner/repo)')
param githubRepo string

// --- Container Registry ---

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: replace('${appName}acr', '-', '')
  location: location
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
  }
}

// --- AcrPull role assignment for Web App managed identity ---

@description('AcrPull built-in role')
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, webApp.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: webApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

// --- App Service Plan ---

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  kind: 'linux'
  properties: {
    reserved: true
  }
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
}

// --- Web App ---

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${appName}-app'
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/${appName}:latest'
      acrUseManagedIdentityCreds: true
      appSettings: [
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'GITHUB_APP_CLIENT_ID', value: githubAppClientId }
        { name: 'GITHUB_APP_CLIENT_SECRET', value: githubAppClientSecret }
        { name: 'GITHUB_APP_ID', value: githubAppId }
        { name: 'GITHUB_APP_PRIVATE_KEY', value: githubAppPrivateKey }
        { name: 'AUTH_SECRET', value: authSecret }
        { name: 'GITHUB_REPO', value: githubRepo }
        { name: 'AUTH_TRUST_HOST', value: 'true' }
      ]
      alwaysOn: true
    }
    httpsOnly: true
  }
}

// --- Outputs ---

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
output acrLoginServer string = acr.properties.loginServer
output acrName string = acr.name
