# syntax = docker/dockerfile:1

ARG NODE_VERSION=16.13.0
FROM node:${NODE_VERSION}-slim as base

LABEL fly_launch_runtime="Node.js"

WORKDIR /app
ENV NODE_ENV="production"
FROM base as build

# RUN apt-get update -qq && \
#     apt-get install -y build-essential pkg-config python-is-python3

COPY --link package-lock.json package.json ./
RUN npm ci

COPY --link . .

FROM base
COPY --from=build /app /app

CMD [ "npm", "run", "start" ]
