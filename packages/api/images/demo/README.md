# Demo seed images

Drop images into the subdirectories below, then re-run `pnpm db:seed:demo`.  
The seed uploads each file it finds to MinIO/S3 and writes the URL back to the
database. Missing files are silently skipped — nothing breaks if a directory is
empty or a particular entity has no image yet.

Accepted formats: **`.webp`** (preferred), `.png`, `.jpg` / `.jpeg`

---

## `players/` — user avatars & banners

| File | Sets |
|---|---|
| `{username}.webp` | `user.avatar_url` |
| `{username}-banner.webp` | `user.banner_url` |

**Usernames (28 accounts):**

```
# SF Shock Main
smurf  viol2t  proper  krakinlakin  moth  shqote

# SF Shock Academy
aznrite  kalios  alarm  leyton  hadi

# Dallas Fuel Main
hanbin  fielder  doha  kariv  crimzo  glister

# Dallas Fuel Challengers
coluge  mag  jmac  funnyastro  pelican

# Coaches
shock-coach  fuel-coach

# Free agents
birdring  colourhex  speedily

# Demo admin
demo
```

---

## `teams/` — team avatars & banners

Use the **lowercase** tag as the filename.

| File | Sets | Team |
|---|---|---|
| `shck.webp` | `team.avatar_url` | SF Shock |
| `shck-banner.webp` | `team.banner_url` | SF Shock |
| `sfs2.webp` | `team.avatar_url` | SF Shock Academy |
| `sfs2-banner.webp` | `team.banner_url` | SF Shock Academy |
| `dal.webp` | `team.avatar_url` | Dallas Fuel |
| `dal-banner.webp` | `team.banner_url` | Dallas Fuel |
| `dalc.webp` | `team.avatar_url` | Dallas Fuel Challengers |
| `dalc-banner.webp` | `team.banner_url` | Dallas Fuel Challengers |

---

## `orgs/` — org avatars & banners

Use the **slug** as the filename.

| File | Sets | Org |
|---|---|---|
| `sf-shock.webp` | `organization.avatar_url` | San Francisco Shock |
| `sf-shock-banner.webp` | `organization.banner_url` | San Francisco Shock |
| `dallas-fuel.webp` | `organization.avatar_url` | Dallas Fuel |
| `dallas-fuel-banner.webp` | `organization.banner_url` | Dallas Fuel |

---

## S3 buckets used

| Bucket | Content |
|---|---|
| `demo-players` | player avatars & banners |
| `demo-teams` | team avatars & banners |
| `demo-orgs` | org avatars & banners |

Buckets are created automatically on first run with a public-read policy,
matching the same pattern as the `heroes` and `maps` buckets.
