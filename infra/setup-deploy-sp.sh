#!/bin/bash
set -euo pipefail

# Creates an Entra App Registration with a federated credential for GitHub Actions OIDC,
# and grants it Contributor on the sharemd resource group.
#
# Run AFTER deploy.sh (the resource group must exist).
# Only needs to be run once.

EXPECTED_SUB="49112093-8017-4deb-8682-7f2cc2483f8b"
APP_DISPLAY_NAME="sp-sharemd-deploy"
GITHUB_ORG="john-manktelow"
GITHUB_REPO="sharemd"
GITHUB_BRANCH="main"
RESOURCE_GROUP="rg_sharemd"

CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$EXPECTED_SUB" ]; then
  echo "ERROR: current subscription is ${CURRENT_SUB}"
  echo "Run: az account set --subscription ${EXPECTED_SUB}"
  exit 1
fi

TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Subscription: $(az account show --query name -o tsv)"
echo "Tenant:       ${TENANT_ID}"
echo

echo "Creating App Registration: ${APP_DISPLAY_NAME}"
APP_ID=$(az ad app create \
  --display-name "${APP_DISPLAY_NAME}" \
  --query appId -o tsv)
echo "  App (client) ID: ${APP_ID}"

OBJECT_ID=$(az ad app show --id "${APP_ID}" --query id -o tsv)

echo "Adding federated credential for ${GITHUB_ORG}/${GITHUB_REPO} branch ${GITHUB_BRANCH}"
az ad app federated-credential create \
  --id "${OBJECT_ID}" \
  --parameters "{
    \"name\": \"github-actions-${GITHUB_REPO}-${GITHUB_BRANCH}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:ref:refs/heads/${GITHUB_BRANCH}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" \
  --output none

echo "Creating service principal"
SP_OBJECT_ID=$(az ad sp create --id "${APP_ID}" --query id -o tsv 2>/dev/null || \
  az ad sp show --id "${APP_ID}" --query id -o tsv)
echo "  SP object ID: ${SP_OBJECT_ID}"

RG_ID=$(az group show --name "${RESOURCE_GROUP}" --query id -o tsv)
echo "Granting Contributor on ${RESOURCE_GROUP}"
az role assignment create \
  --assignee-object-id "${SP_OBJECT_ID}" \
  --assignee-principal-type ServicePrincipal \
  --role "Contributor" \
  --scope "${RG_ID}" \
  --output none

echo
echo "Done. Add these as GitHub repo secrets in ${GITHUB_ORG}/${GITHUB_REPO}:"
echo
echo "  AZURE_CLIENT_ID       ${APP_ID}"
echo "  AZURE_TENANT_ID       ${TENANT_ID}"
echo "  AZURE_SUBSCRIPTION_ID ${CURRENT_SUB}"
