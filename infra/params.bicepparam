using './main.bicep'

param appName = 'sharemd'
param location = 'Australia East'

param dnsResourceGroupName = 'commute-dns'
param dnsZoneName = 'commute.fm'
param dnsRecordName = 'sharemd'

param containerImage = 'ghcr.io/john-manktelow/sharemd:latest'

param githubAppClientId = 'Iv23licteik3p9tCp5aI'
param githubAppId = '3394703'

// Auto-filled by deploy.sh — leave empty here.
param deployerObjectId = ''
