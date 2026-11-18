# Test deployment of the accounts server (Cloud Run). SQLite lives in /tmp: data is lost when the instance stops.
FROM node:24-slim
WORKDIR /srv
RUN npm install --no-save --no-audit --no-fund express@5.3.0 tsx@4.23.15
COPY src ./src
ENV NODE_ENV=production ACCOUNTS_DB=/tmp/accounts.db TRUST_PROXY=1
USER node
CMD ["npx", "tsx", "src/main.ts"]
