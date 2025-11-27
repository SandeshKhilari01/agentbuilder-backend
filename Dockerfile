FROM node:20-alpine

WORKDIR /app

# Install OpenSSL and other dependencies for Prisma
RUN apk add --no-cache openssl openssl-dev libc6-compat

COPY package*.json ./

RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
