targetScope = 'subscription'

param appName string = 'sharemd'
param location string = 'Australia East'

@description('Resource group hosting the commute.fm DNS zone')
param dnsResourceGroupName string = 'commute-dns'

param dnsZoneName string = 'commute.fm'
param dnsRecordName string = 'sharemd'

@description('Full ghcr.io image reference including tag')
param containerImage string = 'ghcr.io/john-manktelow/sharemd:latest'

@description('Object ID of the deployer — granted Key Vault Administrator to populate secrets')
param deployerObjectId string

// ---------------------------------------------------------------------------

var rgName = 'rg_${appName}'
var customDomain = '${dnsRecordName}.${dnsZoneName}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: rgName
  location: location
}

resource rgDns 'Microsoft.Resources/resourceGroups@2024-03-01' existing = {
  name: dnsResourceGroupName
}

// --- Identity (UAI for KV access) -------------------------------------------

module identity 'modules/identity.bicep' = {
  scope: rg
  name: 'identityModule'
  params: {
    appName: appName
    location: location
  }
}

// --- Key Vault (secrets populated manually post-deploy) ---------------------

module keyVault 'modules/keyVault.bicep' = {
  scope: rg
  name: 'keyVaultModule'
  params: {
    appName: appName
    location: location
    appPrincipalId: identity.outputs.principalId
    deployerObjectId: deployerObjectId
  }
}

// --- Container Apps Environment + Log Analytics (consumption — free grant) ---

module environment 'modules/environment.bicep' = {
  scope: rg
  name: 'environmentModule'
  params: {
    appName: appName
    location: location
  }
}

// --- DNS (cross-scope, using predicted FQDN) --------------------------------

module dns 'modules/dns.bicep' = {
  scope: rgDns
  name: 'dnsModule'
  params: {
    dnsZoneName: dnsZoneName
    recordName: dnsRecordName
    containerAppFqdn: 'app-${appName}.${environment.outputs.defaultDomain}'
  }
}

// --- Container App (after DNS + KV so custom domain and secret refs work) ---

module app 'modules/app.bicep' = {
  scope: rg
  name: 'appModule'
  dependsOn: [dns]
  params: {
    appName: appName
    location: location
    environmentId: environment.outputs.environmentId
    containerImage: containerImage
    customDomain: customDomain
    identityId: identity.outputs.id
    keyVaultUri: keyVault.outputs.keyVaultUri
  }
}

// --- Managed cert (after app exists, validates via CNAME) -------------------

module cert 'modules/cert.bicep' = {
  scope: rg
  name: 'certModule'
  dependsOn: [app]
  params: {
    appName: appName
    location: location
    environmentName: environment.outputs.environmentName
    customDomain: customDomain
  }
}

// --- Outputs ----------------------------------------------------------------

output resourceGroupName string = rg.name
output appUrl string = 'https://${customDomain}'
output defaultFqdn string = 'app-${appName}.${environment.outputs.defaultDomain}'
output keyVaultName string = keyVault.outputs.keyVaultName
