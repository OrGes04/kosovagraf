# Photo permissions

Photos whose owners have allowed us to use them. Copyrighted photos are never published
without one of these.

## While waiting for an answer

1. Put the photo in `media-local/scenes/<id>.jpg`, where `<id>` is the scene's
   `pendingImage.id` (see the scene's JSON file). This folder is git-ignored.
2. Run `npm run images`, then `npm run dev`. The scene shows the photo **on your computer
   only**, with "awaiting permission" in the sources panel. The public site and any
   production build keep showing the scene's free stand-in photo.

## When the owner says yes

1. Save the permission here as `<scene-id>.md` (or `.pdf`/`.eml`): who gave it, when, for
   which photo, and the credit line they asked for. An email is enough.
2. Move the photo from `media-local/scenes/` to `media-src/scenes/`.
3. In the scene's JSON: set `image` to the photo's id, `imageLicense` to `"permission"`,
   `imageLicenseDetail` to e.g. `"Permission from Hazir Reka, 2026-11-20"`, `imageCredit` to
   the credit line, and remove `pendingImage`.
4. Run `npm run depth` and `npm run images`, check it, commit and push.

## Requests sent

| Date | To | For scenes | Status |
|---|---|---|---|
| 2026-11-12 | Owners listed in each Era V–VI scene's `pendingImage` (sent by the project owner) | Era V, Era VI | waiting |
