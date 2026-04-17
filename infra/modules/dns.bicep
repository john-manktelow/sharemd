param dnsZoneName string
param recordName string
param containerAppFqdn string
param customDomainVerificationId string

resource zone 'Microsoft.Network/dnsZones@2023-07-01-preview' existing = {
  name: dnsZoneName
}

resource cname 'Microsoft.Network/dnsZones/CNAME@2023-07-01-preview' = {
  parent: zone
  name: recordName
  properties: {
    TTL: 3600
    CNAMERecord: {
      cname: containerAppFqdn
    }
  }
}

resource asuid 'Microsoft.Network/dnsZones/TXT@2023-07-01-preview' = {
  parent: zone
  name: 'asuid.${recordName}'
  properties: {
    TTL: 3600
    TXTRecords: [
      {
        value: [
          customDomainVerificationId
        ]
      }
    ]
  }
}
