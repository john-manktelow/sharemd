targetScope = 'subscription'

param appName string = 'sharemd'
param location string = 'Australia East'

@description('Resource group hosting the commute.fm DNS zone')
param dnsResourceGroupName string = 'commute-dns'

param dnsZoneName string = 'commute.fm'
param dnsRecordName string = 'sharemd'

@description('Full ghcr.io image reference including tag')
param containerImage string = 'ghcr.io/john-manktelow/sharemd:latest'

@description('GitHub App client ID (not sensitive)')
param githubAppClientId string

@description('GitHub App numeric ID (not sensitive)')
param githubAppId string

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

// --- Container App (no custom domain yet — need verification ID first) ------

module app 'modules/app.bicep' = {
  scope: rg
  name: 'appModule'
  params: {
    appName: appName
    location: location
    environmentId: environment.outputs.environmentId
    containerImage: containerImage
    customDomain: customDomain
    identityId: identity.outputs.id
    keyVaultUri: keyVault.outputs.keyVaultUri
    githubAppClientId: githubAppClientId
    githubAppId: githubAppId
  }
}

// --- DNS CNAME + asuid TXT (after app, using its verification ID) -----------

module dns 'modules/dns.bicep' = {
  scope: rgDns
  name: 'dnsModule'
  params: {
    dnsZoneName: dnsZoneName
    recordName: dnsRecordName
    containerAppFqdn: app.outputs.fqdn
    customDomainVerificationId: app.outputs.customDomainVerificationId
  }
}

// --- Managed cert (after DNS, validates via CNAME) --------------------------

module appDomain 'modules/appDomain.bicep' = {
  scope: rg
  name: 'appDomainModule'
  dependsOn: [dns]
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
output defaultFqdn string = app.outputs.fqdn
output keyVaultName string = keyVault.outputs.keyVaultName
