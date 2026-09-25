# Linux desktop image for X11/Wayland forwarding. The native installers
# (DMG, NSIS, AppImage) are the supported way to run pidex day to day.
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libx11-6 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    libxshmfence1 \
  && rm -rf /var/lib/apt/lists/*

COPY linux-unpacked /opt/pidex
RUN chmod +x /opt/pidex/pidex

ENV ELECTRON_DISABLE_SECURITY_WARNINGS=1
ENTRYPOINT ["/opt/pidex/pidex"]
