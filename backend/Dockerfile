FROM node:18-slim

WORKDIR /app

# Copy package files first for better caching
COPY package.json ./
RUN npm install

# Copy the rest of the application
COPY . .

EXPOSE 3001

CMD ["npm", "start"] 