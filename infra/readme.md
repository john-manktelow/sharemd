# sharemd infra

Container Apps (free tier) in the Commute subscription, custom domain at
`sharemd.commute.fm`. Images on ghcr.io. Secrets in Key Vault.

## What gets created

In `rg_sharemd`:
- User-assigned managed identity (`uai-sharemd`)
- Key Vault (`kv-sharemd`) — secrets populated manually after first deploy
- Log Analytics workspace (free 5 GB/mo ingest)
- Container Apps Environment (consumption workload profile)
- Container App pulling from `ghcr.io/john-manktelow/sharemd`, secrets via KV refs
- Managed TLS certificate for `sharemd.commute.fm`

In `commute-dns` (cross-scope):
- CNAME `sharemd` pointing at the Container App FQDN

## First deploy

The Container App reads secrets from Key Vault at provision time, so the
secrets must exist before the app is created. On the very first deploy the
KV will be created but the app will fail — populate the secrets then rerun.

```bash
cd infra
az account set --subscription 49112093-8017-4deb-8682-7f2cc2483f8b
./deploy.sh        # KV + environment created; app will fail (secrets missing)
```

Populate the secrets in `kv-sharemd` (the deploy script grants you
Key Vault Administrator). `GHCR-PAT` is a GitHub PAT (classic) with
`read:packages` scope — used to pull the private container image:

```bash
az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-CLIENT-SECRET --value '...'
az keyvault secret set --vault-name kv-sharemd --name GITHUB-APP-PRIVATE-KEY --value '...'
az keyvault secret set --vault-name kv-sharemd --name AUTH-SECRET --value "$(openssl rand -hex 32)"
az keyvault secret set --vault-name kv-sharemd --name GHCR-PAT --value '...'
```

Then rerun the deploy — the app will now provision successfully:

```bash
./deploy.sh
```

The deploy script also binds the managed cert to the custom domain.

Set up GitHub Actions OIDC (first time only):

```bash
./setup-deploy-sp.sh
```

Then add the three secrets it prints to the GitHub repo settings.

## Subsequent deploys

Push to `main` — the workflow builds, pushes to ghcr.io, and updates the
Container App image. Secrets stay in Key Vault, untouched by bicep.

## Cost

Effectively $0. Container Apps free grant covers 2M requests/mo and 180k
vCPU-seconds. ghcr.io is free for public repos. Log Analytics free tier is
5 GB/mo. Key Vault standard tier is $0.03/10k operations (pennies).
Scale-to-zero means no compute cost when idle (cold starts ~3-5s).
