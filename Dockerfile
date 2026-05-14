FROM node:20-alpine

# Install packages
RUN apk add --no-cache \
    bash \
    git \
    python3 \
    make \
    g++

# Create non-root user
RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

# Create writable workspace
RUN mkdir -p /tmp/session && \
    chown -R sandbox:sandbox /tmp/session

# Remove dangerous binaries
RUN rm -f /usr/bin/sudo || true

USER sandbox

WORKDIR /tmp/session

ENV HOME=/tmp/session

CMD ["bash"]