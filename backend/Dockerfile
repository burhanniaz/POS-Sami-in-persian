FROM node:20-alpine

# Prisma needs OpenSSL to detect the right query engine binary to use.
# Alpine doesn't ship it by default — without this, the build still
# succeeds (with a warning) but can crash at runtime once Prisma actually
# tries to connect to the database with a mismatched engine.
RUN apk add --no-cache openssl

WORKDIR /app

# Prisma's schema must be present before `npm ci`, because the postinstall
# hook (`prisma generate`, defined in package.json) runs automatically
# during npm ci — if the schema isn't copied in yet at that point, the
# build fails with "Could not find Prisma Schema".
COPY package.json package-lock.json ./
COPY prisma ./prisma

# Includes devDependencies (prisma CLI) since we need it in this same
# image — this is a single-stage build for simplicity. This also runs
# postinstall -> `prisma generate` now that the schema is present above.
RUN npm ci

# Now copy the rest of the source.
COPY src ./src

# Uploaded product images / store logo live here. Mount an EasyPanel
# volume to this exact path so uploads survive redeploys — see the
# deployment guide. The directory must exist so multer doesn't fail on
# a fresh container before the volume is attached.
RUN mkdir -p /app/uploads

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]