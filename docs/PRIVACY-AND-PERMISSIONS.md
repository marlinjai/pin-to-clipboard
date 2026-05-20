# Privacy and permissions

## Data
Pin to Clipboard collects nothing. No analytics, no telemetry, no remote code. All actions are local and user-initiated. The only stored state is two user preferences in `chrome.storage.sync`.

## Permission justifications (copy verbatim into the Web Store form)

- **storage**: "Stores only the user's two extension settings (image quality, video action). No browsing data, no media, no identifiers."
- **downloads**: "Used only to save a Pinterest video when the user explicitly clicked the copy button with the Download setting selected."
- **offscreen**: "Used only to convert an image the OS clipboard cannot accept natively (e.g. WebP) into PNG so the clipboard write can succeed."
- **host *://*.pinterest.com/***: "The extension only operates on Pinterest pages, where it injects the copy button."
- **host *://i.pinimg.com/*** and **v.pinimg.com**: "Fetches the specific media the user clicked to copy. No background traffic, no other requests."

## Single purpose
Copy Pinterest media to the user's clipboard with one click. The optional video download is a subordinate convenience of the same copy action.
