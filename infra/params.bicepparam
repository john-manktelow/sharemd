using './main.bicep'

param appName = 'sharemd'
param location = 'Australia East'

param dnsResourceGroupName = 'commute-dns'
param dnsZoneName = 'commute.fm'
param dnsRecordName = 'sharemd'

param containerImage = 'ghcr.io/john-manktelow/sharemd:latest'

// Auto-filled by deploy.sh — leave empty here.
param deployerObjectId = ''
