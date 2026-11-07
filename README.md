# Orb

A dashboard for Home Assistant: soft, round cards read at a glance. Every supported device in a room-by-room page,
laid out for you and kept up to date, on a phone, a tablet or a wall panel.

![Orb on a tablet](https://raw.githubusercontent.com/Krystosterone/dashhaus/main/docs/src/assets/skins/tablet-orb-light.webp)

Each card has a round button for its main action. Lights, climate and covers get a slider or stepper beside it, and
readings show a big figure. The yellow accent shows what is on, and a dashed outline means a device is unavailable.
Tap a card's name, or press and hold its button, to open more in a sheet.

## Install

You need Home Assistant 2026.5 or newer and an administrator account. Nothing to install on your computer.

1. [Open Orb in your Home Assistant](https://my.home-assistant.io/redirect/hacs_repository/?owner=Krystosterone&repository=orb-dashboard&category=plugin)
   and press **Download**. Home Assistant 2026.11 or newer opens its Marketplace; an older one opens HACS. If you're
   asked to add a custom repository, say yes; its type is **Dashboard**.
2. Reload the browser tab.
3. **Settings → Dashboards → Add dashboard**, pick **Orb** under Community dashboards, and press **Create**.

Orb opens from the sidebar, laid out from your house. It follows Home Assistant's light or dark mode, and Orb as it
updates. No other dashboard is touched.

More, with a wall panel's settings and your own layout: [krystosterone.github.io/dashhaus/orb](https://krystosterone.github.io/dashhaus/orb/).

---

Orb is drawn on [Dashhaus](https://krystosterone.github.io/dashhaus/intro/), open hooks for Home Assistant you can draw
a look of your own on. Its source and issues are at [Krystosterone/dashhaus](https://github.com/Krystosterone/dashhaus).
MIT licensed.
