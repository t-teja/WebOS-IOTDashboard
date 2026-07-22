# WebOS IOT Dashboard

**by Tejalabs**

Fullscreen IoT dashboards on LG webOS TVs. Open Node-RED, Grafana, InfluxDB, Home Assistant, or any HTTP(S) board on the big screen.

## Features

- Add and manage multiple named dashboard URLs
- Type tags: Node-RED · Grafana · InfluxDB · Home Assistant · Custom
- Set a **default** dashboard (opens automatically on launch)
- Hidden side menu via the **Back** button to switch boards or open settings
- Optional **auto-cycle** timer between saved dashboards
- Import / export JSON backup
- TV-first UI with D-pad focus, large targets, and strong focus rings

## Screenshots

_Coming soon._

## Remote controls

| Action | Control |
|--------|---------|
| Open menu while viewing | **Back** |
| Close menu / modal | **Back** |
| Move focus | **↑ ↓ ← →** |
| Activate | **OK** |
| Return to viewer from Configure | **Back** (when boards exist) |

## Desktop preview

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080` in a browser. Use `Esc` for Back and arrow keys for focus.

## Install on LG webOS TV

1. Enable **Developer Mode** on the TV and install the [webOS TV CLI](https://webostv.developer.lge.com/develop/tools/cli-installation).
2. Package and install:

```bash
ares-package .
ares-install com.tejalabs.iotdashboard_1.0.0_all.ipk
ares-launch com.tejalabs.iotdashboard
```

App ID: `com.tejalabs.iotdashboard`

## Embedding notes

Some services block iframes (`X-Frame-Options` / CSP). Prefer LAN URLs. Grafana may need `allow_embedding = true`. Home Assistant often needs a kiosk or proxy URL that allows framing.

## License

MIT

## Author

**Tejalabs**
