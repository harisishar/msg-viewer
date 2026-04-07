<div align="center">
    <img src="https://github.com/user-attachments/assets/f065cc3a-c40b-4917-ac51-006cfbc78f0f" alt="Icon"/>
    <p><strong>MSG & EML Viewer</strong></p>
</div>

### Description
A free, in-browser email file viewer that supports both Outlook `.msg` and standard `.eml` files. No data is ever sent to an external server — everything runs client-side in your browser. It is extremely fast and works on any device with an internet connection.

### Features
  - **Free** (Open Source)
  - **No Server** — no data sharing, everything stays in your browser
  - **Supports .msg and .eml** — both formats in one unified viewer
  - **Extremely Fast** — client-side parsing with no upload
  - **Secure** — HTML email bodies sanitized with DOMPurify (XSS protection, remote images blocked)
  - **Works on any device** that can open the page

### .msg Support
  - Full Outlook .msg parsing (OLE2 Compound File format)
  - Headers, body (HTML/RTF/plain text), attachments, embedded messages

### .eml Support
  - Full RFC 822/MIME parsing via [postal-mime](https://github.com/nicbarker/postal-mime)
  - Multipart (mixed, alternative) with correct body selection
  - Base64 and quoted-printable decoding
  - RFC 2047 encoded header decoding (non-ASCII subjects, sender names)
  - Character set handling (UTF-8, ISO-8859-*, etc.)
  - HTML body sanitization with DOMPurify
  - Remote image blocking by default (privacy protection)

### Development

#### Prerequisites
- [Bun](https://bun.sh/) (latest stable)

#### Install
```
bun install
```

#### Build
```
bun run build.ts
```
The command will output the built application to the `build` folder.

#### Test
```
bun test
```

### Deployment
The page is hosted via Cloudflare Pages.

### Credits
This project is a fork of [msg-viewer](https://github.com/molotochok/msg-viewer) by [Markiian Karpa](https://github.com/molotochok). The original project built the .msg parsing foundation and the web-based viewer. This fork adds .eml file support, HTML sanitization, and a unified file picker.

If you wish to support the original author, you can buy them a [coffee](https://buymeacoffee.com/markian98f).
