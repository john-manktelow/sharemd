param appName string
param location string
param environmentName string
param customDomain string

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: environmentName
}

resource managedCert 'Microsoft.App/managedEnvironments/managedCertificates@2024-03-01' = {
  parent: environment
  name: 'cert-${appName}'
  location: location
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}

output certId string = managedCert.id
output certName string = managedCert.name
