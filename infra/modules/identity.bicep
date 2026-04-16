param appName string
param location string

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-07-31-preview' = {
  name: 'uai-${appName}'
  location: location
}

output principalId string = identity.properties.principalId
output id string = identity.id
output name string = identity.name
