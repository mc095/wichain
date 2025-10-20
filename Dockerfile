FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    file \
    libwebkit2gtk-4.0-dev \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    build-essential \
    nodejs \
    npm

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Set working directory
WORKDIR /app

# Copy project
COPY . .

# Build frontend
WORKDIR /app/wichain-backend/frontend
RUN npm install && npm run build

# Build Tauri
WORKDIR /app/wichain-backend/src-tauri
RUN cargo tauri build

# Output location
RUN echo "Build complete! Artifacts in target/release/bundle/"
