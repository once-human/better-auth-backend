FROM node:18-alpine

WORKDIR /app

# Only copy package.json first
COPY package.json ./

# Install production dependencies WITHOUT lockfile
RUN npm install --omit=dev

# Copy rest of the code
COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "index.js"]
