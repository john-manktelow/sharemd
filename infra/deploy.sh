#!/bin/bash
set -euo pipefail

EXPECTED_SUB="49112093-8017-4deb-8682-7f2cc2483f8b"
RG="rg_sharemd"
APP="app-sharemd"
HOSTNAME="sharemd.commute.fm"
CERT="cert-sharemd"
ENV="cae-sharemd"

CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$EXPECTED_SUB" ]; then
  echo "ERROR: current subscription is ${CURRENT_SUB}"
  echo "Run: az account set --subscription ${EXPECTED_SUB}"
  exit 1
fi

DEPLOYER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

echo "Deploying sharemd into: $(az account show --query name -o tsv)"
echo "Deployer object ID: ${DEPLOYER_OBJECT_ID}"
echo

az deployment sub create \
  --location AustraliaEast \
  --template-file main.bicep \
  --parameters params.bicepparam \
  --parameters deployerObjectId="${DEPLOYER_OBJECT_ID}"

# Bind custom hostname + cert (idempotent — safe to run on every deploy)
echo
echo "Binding custom hostname..."
az containerapp hostname add -g "${RG}" -n "${APP}" --hostname "${HOSTNAME}" 2>/dev/null || true
az containerapp hostname bind -g "${RG}" -n "${APP}" \
  --hostname "${HOSTNAME}" --certificate "${CERT}" --environment "${ENV}" 2>/dev/null || true

echo
echo "Done."
echo
echo "If this is the first deploy, populate secrets in kv-sharemd:"
echo "  az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-CLIENT-ID --value '...'"
echo "  az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-CLIENT-SECRET --value '...'"
echo "  az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-ID --value '...'"
echo "  az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-PRIVATE-KEY --value '...'"
echo "  az keyvault secret set --vault-name kv-sharemd --name AUTH-SECRET --value \"\$(openssl rand -hex 32)\""
