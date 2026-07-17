# Tag signing & push

The `tag.yml` workflow signs tags with an SSH key passed in via the
`TAG_SIGNING_KEY` repository secret. The **same key** is reused to push
the tag (because pushing with `GITHUB_TOKEN` does not trigger downstream
workflows on GitHub — see [the docs](https://docs.github.com/en/actions/security-guides/automatic-token-authentication)).

## Setup (one time)

### 1. Generate an SSH key

```sh
ssh-keygen -t ed25519 -C "github-actions tag signing + push" -f ~/.ssh/tag_signing
```

Answer "no passphrase" (GitHub Actions can't prompt for one).

### 2. Register the public key on GitHub

1. Print the public key:
   ```sh
   cat ~/.ssh/tag_signing.pub
   ```
2. Go to **GitHub → repo → Settings → Deploy keys → Add deploy key**
3. **Title:** `Tag signing + push (CI)`
4. **Key:** paste the public key
5. **☑ Allow write access** ← required for `git push`
6. Save.

> Note: the key is added as a **Deploy key** (not a personal SSH key), so
> it only has access to this repo. That keeps the blast radius small if
> the key ever leaks.

### 3. Add the private key as a repository secret

1. Print the private key (including the `-----BEGIN/END-----` lines):
   ```sh
   cat ~/.ssh/tag_signing
   ```
2. Go to **GitHub → repo → Settings → Secrets and variables → Actions →
   New repository secret**
3. **Name:** `TAG_SIGNING_KEY`
4. **Value:** paste the entire private key

### 4. Verify locally

To verify tags locally, register the public key in your allowed signers:

```sh
# One-time: create or append to allowed signers
echo "$(cat ~/.ssh/tag_signing.pub)" >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

Then:

```sh
git verify-tag v0.1.0
# Good signature from ...
```

On GitHub, the tag's commit page shows a "Verified" badge.

## Switching to GPG

If you'd rather sign with GPG:

1. Export the private key:
   ```sh
   gpg --export-secret-keys --armor <KEY_ID>
   ```
2. Add two secrets: `GPG_PRIVATE_KEY` (the armored key) and `GPG_PASSPHRASE`
   (empty if your key has no passphrase).
3. **Important:** push auth still needs to use a non-GITHUB_TOKEN mechanism
   (e.g., a separate SSH deploy key with write access) for release.yml to
   fire. Tag.yml should keep the SSH push step even when switching signing
   to GPG.

## Skipping signing

If `TAG_SIGNING_KEY` is not set, `tag.yml` falls back to creating an
unsigned tag with a `::warning::` annotation. The tag is still pushed (and
release.yml still fires) but the tag won't have a "Verified" badge on
GitHub.