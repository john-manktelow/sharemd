#!/bin/bash
set -euo pipefail

EXPECTED_SUB="49112093-8017-4deb-8682-7f2cc2483f8b"

CURRENT_SUB=$(az account show --query id -o tsv)
if [ "$CURRENT_SUB" != "$EXPECTED_SUB" ]; then
  echo "ERROR: current subscription is ${CURRENT_SUB}"
  echo "Run: az account set --subscription ${EXPECTED_SUB}"
  exit 1
fi

DEPLOYER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv)

az deployment sub what-if \
  --location AustraliaEast \
  --template-file main.bicep \
  --parameters params.bicepparam \
  --parameters deployerObjectId="${DEPLOYER_OBJECT_ID}"
