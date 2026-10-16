Riddim Swap: installable app
============================

What this is
  A self-contained web app. Host this folder on any HTTPS website and it can be
  installed on a phone's Home Screen. It then opens full screen, works offline,
  and keeps projects in its own storage on that phone.

Files
  index.html             the app
  manifest.webmanifest   app name, icons, full-screen setting
  sw.js                  offline support (saves the app on the phone)
  icons/                 Home Screen icons
  vendor/mp4-muxer.js    builds MP4 recordings (MIT licence, see mp4-muxer-LICENSE.txt)

Hosting (any one of these, all free)
  - GitHub Pages: create a repository, upload these files, then
    Settings > Pages > Deploy from branch > main / root.
  - Netlify Drop: on a computer, open app.netlify.com/drop and drag this folder in.
  - Cloudflare Pages: Create project > Direct upload > upload this folder.
  It must be served over HTTPS (all three do this).

Install on iPhone
  1. Open the site in Safari.
  2. Tap the Share button, then "Add to Home Screen", then Add.
  3. Open Riddim Swap from the Home Screen icon.

Notes
  - Projects live on the phone, inside the installed app. Use Projects > Save backup file
    to keep a copy, and Open backup file to bring it into the app on another device.
  - Projects saved inside the Claude version don't carry over automatically: open them
    there, tap Save backup file, then open that file in the installed app and re-add
    the same videos and song.
  - Updates: replace the files on the host. The app picks up the new version the next
    time it's opened online.
