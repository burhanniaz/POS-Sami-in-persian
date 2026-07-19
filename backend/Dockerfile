FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching — this layer only
# re-runs when package.json/package-lock.json actually change).
# Includes devDependencies (prisma CLI) since we need `npx prisma generate`
# in this same image — this is a single-stage build for simplicity.
COPY package.json package-lock.json ./
RUN npm ci

# Prisma needs its schema present before `prisma generate` (also runs
# automatically via postinstall above, but we run it explicitly here too
# so the build fails loudly and immediately if the schema has an error,
# rather than surfacing as a confusing runtime crash later).
COPY prisma ./prisma
RUN npx prisma generate

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
