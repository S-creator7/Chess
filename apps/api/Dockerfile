FROM node:20-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile=false
WORKDIR /app/apps/api
RUN pnpm prisma:generate
EXPOSE 3001
CMD ["sh", "-c", "pnpm prisma:push && pnpm start"]
