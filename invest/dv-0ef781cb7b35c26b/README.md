# Dark Value – Investor Briefing (private page)

Static single-page investor memo for Applied Identities. Self-contained: `index.html`,
`styles.css`, `app.js`, plus Chart.js 4.4.1 from cdnjs. No backend, no build step.

## Access model (privacy by obscurity, NOT authentication)

The page lives at an unguessable path:

```
https://appliedidentities.com/invest/dv-0ef781cb7b35c26b/
```

- **Unguessable slug.** The `dv-<random>` directory name is the only thing standing between
  the page and the public. It is not linked from any public page and carries
  `<meta name="robots" content="noindex, nofollow">`.
- **Per-recipient token.** Append `?v=<recipient-id>` to each link you send. `app.js` reads it,
  sanitizes it, and sets it as a custom analytics property so you can tell which recipient
  opened the link. Example: `.../dv-0ef781cb7b35c26b/?v=jsmith`.
- **Optional personalization.** Append `&name=<First Last>` to render
  "Prepared for First Last" into the confidential line. Input is sanitized before it
  touches the DOM.

This is privacy by obscurity, not real authentication. Anyone with the URL can view the page.
Do not treat the slug as a secret control for material non-public information; treat it as a
soft gate for a friends-and-family distribution.

## Before sending any link

1. Analytics is wired to Plausible with `data-domain="appliedidentities.com"`. For events to
   record, `appliedidentities.com` must be a registered site in the Plausible account; the
   `?v=` recipient token is sent as a custom `recipient` prop on the pageview. (Swap the
   snippet for Fathom if preferred.)
2. Route through Will duPont (CEO) for IP sign-off per AI-MEMO-DARKVALUE-2026-05-30-001.

## Deploy

This directory sits in the Hugo source tree under `static/`, which Hugo copies verbatim to
`public/`. To publish:

```
cd ~/appliedidentities-source && hugo
rsync -av --delete ~/appliedidentities-source/public/ ~/appliedidentities-public/ --exclude='.git'
# commit + push both repos, then:
ssh root@5.161.188.219 "bash /var/www/deploy-ai.sh"
```

Because the files live in `static/`, they survive Hugo rebuilds and prod deploys (they are
version-controlled, unlike a manual drop into the public tree).
