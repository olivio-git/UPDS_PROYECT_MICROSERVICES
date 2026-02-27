# Puppeteer PDF Generation Setup

This document explains how to set up the professional PDF generation service using Puppeteer.

## Docker Setup Options

### Option 1: Use the Puppeteer-enabled Dockerfile (Recommended)

Replace your current Dockerfile with `dockerfile.puppeteer`:

```bash
# Rename current dockerfile
mv dockerfile dockerfile.original

# Use the Puppeteer-enabled dockerfile
mv dockerfile.puppeteer dockerfile
```

This will install Chrome and all necessary dependencies for Puppeteer.

### Option 2: Environment Variables (if Chrome is installed elsewhere)

If you have Chrome installed in a custom location, set the environment variable:

```bash
# In your docker-compose.yml or environment
CHROME_EXECUTABLE_PATH=/path/to/chrome
```

Common Chrome locations:
- Ubuntu/Debian: `/usr/bin/google-chrome-stable`
- Alpine Linux: `/usr/bin/chromium-browser`
- Custom installations: `/opt/google/chrome/chrome`

## Fallback System

The PDF service automatically falls back to PDFKit-based generation if Puppeteer fails:

1. **Professional Mode**: Uses Puppeteer with HTML/CSS templates for beautiful PDFs
2. **Fallback Mode**: Uses PDFKit for basic PDF generation when Chrome is unavailable
3. **LLM Integration**: Both modes support AI analysis integration

## Docker Compose Configuration

For docker-compose.yml, you can add environment variables:

```yaml
services:
  exam-service:
    build: .
    environment:
      - CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
      - NODE_ENV=production
    volumes:
      - /dev/shm:/dev/shm  # Shared memory for Chrome
```

## Manual Installation (Development)

For local development without Docker:

```bash
# Install Puppeteer browsers
npx puppeteer browsers install chrome

# Or install system Chrome
# Ubuntu/Debian:
sudo apt-get install google-chrome-stable

# macOS:
brew install --cask google-chrome

# Set environment variable
export CHROME_EXECUTABLE_PATH=$(which google-chrome-stable)
```

## Testing

Test PDF generation:

1. **Check logs**: Look for "Puppeteer browser launched successfully" or fallback warnings
2. **Generate PDF**: Use the export endpoints to test PDF generation
3. **Verify quality**: Professional mode produces magazine-quality PDFs with CSS styling

## Memory Considerations

Puppeteer can be memory-intensive:

- Allocate at least 1GB RAM for the container
- Use `--disable-dev-shm-usage` flag (already included)
- Consider setting memory limits in docker-compose

```yaml
services:
  exam-service:
    deploy:
      resources:
        limits:
          memory: 1G
        reservations:
          memory: 512M
```

## Troubleshooting

### Common Issues:

1. **Chrome not found**: Use the Puppeteer-enabled Dockerfile
2. **Memory issues**: Increase container memory allocation
3. **Sandboxing**: The `--no-sandbox` flag is already included for Docker
4. **Fonts missing**: The Puppeteer Dockerfile includes font packages

### Log Messages:

- ✅ `"Puppeteer browser launched successfully"` - Professional mode working
- ⚠️ `"usando fallback"` - Falling back to basic PDFKit mode
- ❌ `"Chrome not found"` - Need to install Chrome or use Puppeteer Dockerfile

The system is designed to be resilient - it will always generate a PDF, either in professional mode or fallback mode.