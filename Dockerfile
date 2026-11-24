FROM node:22-alpine
WORKDIR /app
COPY index.html lab.js server.cjs test-control.cjs ./
RUN node --check server.cjs && node test-control.cjs
USER node
CMD ["node","server.cjs"]
