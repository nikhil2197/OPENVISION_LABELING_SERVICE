FROM node:18-slim AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./
RUN npm install

# Copy the rest of the application
COPY . .

RUN npm run build

# --- Production image ---
FROM node:18-slim AS runner

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/tailwind.config.ts ./
COPY --from=builder /app/postcss.config.js ./
COPY --from=builder /app/tsconfig.json ./

EXPOSE 3000

ENV NODE_ENV=production

CMD ["npx", "next", "start"] 