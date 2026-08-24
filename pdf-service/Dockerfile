# Official Playwright image, matching the exact playwright version pinned in
# package-lock.json (1.61.1) — it ships Chromium plus every OS-level
# dependency Playwright needs already installed, which is the reliable way
# to run Playwright in a container (installing the browser + its system
# deps via a plain Node buildpack is fragile without root/apt access).
FROM mcr.microsoft.com/playwright:v1.61.1-resolute

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["node", "server.mjs"]
