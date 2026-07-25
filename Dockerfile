# Use official Node.js light alpine image for tiny and fast container
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for caching dependency layer
COPY package.json package-lock.json ./

# Install ALL dependencies (including devDependencies like esbuild & tsx to build)
RUN npm ci

# Copy server files, directories, and TS configs
COPY server.ts tsconfig.json firebase-applet-config.json* ./
COPY server ./server
COPY ota-releases ./ota-releases

# Compile only the Express backend to dist/server.cjs using esbuild (ignoring Vite client build)
RUN npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs

# Prune node_modules to keep image production-grade and lightweight
RUN npm prune --production

# Expose port 3000 (standard for Railway / ingress)
EXPOSE 3000

# Set environment variables for production execution
ENV NODE_ENV=production
ENV PORT=3000

# Start command
CMD ["node", "dist/server.cjs"]
