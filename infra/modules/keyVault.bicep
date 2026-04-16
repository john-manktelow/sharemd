param appName string
param location string
param appPrincipalId string
param deployerObjectId string

resource keyvault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${appName}'
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    publicNetworkAccess: 'Enabled'
  }
}

// Key Vault Secrets User — lets the Container App read secrets at runtime.
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource appSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyvault.id, appPrincipalId, secretsUserRoleId)
  scope: keyvault
  properties: {
    principalId: appPrincipalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
  }
}

// Key Vault Administrator — lets the deployer add/rotate secret values manually.
var kvAdminRoleId = '00482a5a-887f-4fb3-b363-3b7fe8e74483'

resource deployerAdmin 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyvault.id, deployerObjectId, kvAdminRoleId)
  scope: keyvault
  properties: {
    principalId: deployerObjectId
    principalType: 'User'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvAdminRoleId)
  }
}

output keyVaultName string = keyvault.name
output keyVaultUri string = keyvault.properties.vaultUri
