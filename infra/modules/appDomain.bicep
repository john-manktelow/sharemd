// Phase 2: bind the custom domain + managed cert onto the existing container app.
// Runs after DNS CNAME + asuid TXT are in place.

param appName string
param location string
param environmentName string
param customDomain string

resource environment 'Microsoft.App/managedEnvironments@2025-07-01' existing = {
  name: environmentName
}

resource managedCert 'Microsoft.App/managedEnvironments/managedCertificates@2025-07-01' = {
  parent: environment
  name: 'cert-${appName}'
  location: location
  properties: {
    subjectName: customDomain
    domainControlValidation: 'CNAME'
  }
}
