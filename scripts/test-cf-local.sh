#!/bin/bash

# Test script for Cloudflare local development

echo "🧪 Testing Cloudflare Functions Local Development Setup"
echo "========================================================"
echo ""

# Check if servers are running
echo "📡 Checking if dev servers are needed..."
echo ""

# Test if Vite is accessible
echo "Testing Vite server on port 5173..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 | grep -q "200\|404"; then
    echo "✅ Vite server is running on port 5173"
else
    echo "⚠️  Vite server is not running. Start it with: npm run dev:vite"
fi

echo ""

# Test if Wrangler is accessible
echo "Testing Wrangler server on port 8788..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8788 | grep -q "200\|404"; then
    echo "✅ Wrangler server is running on port 8788"
else
    echo "⚠️  Wrangler server is not running. Start it with: npm run dev:wrangler"
fi

echo ""

# Test health endpoint directly on wrangler
echo "Testing /api/health endpoint on Wrangler (port 8788)..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:8788/api/health)
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | grep -v "HTTP_STATUS:")

if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ Health endpoint responding on Wrangler server"
    echo "   Response: $BODY"
else
    echo "❌ Health endpoint not responding (HTTP $HTTP_STATUS)"
fi

echo ""

# Test health endpoint through Vite proxy
echo "Testing /api/health endpoint through Vite proxy (port 5173)..."
PROXY_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" http://localhost:5173/api/health)
PROXY_STATUS=$(echo "$PROXY_RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
PROXY_BODY=$(echo "$PROXY_RESPONSE" | grep -v "HTTP_STATUS:")

if [ "$PROXY_STATUS" = "200" ]; then
    echo "✅ API proxy working through Vite"
    echo "   Response: $PROXY_BODY"
else
    echo "❌ API proxy not working (HTTP $PROXY_STATUS)"
fi

echo ""
echo "========================================================"
echo ""

if [ "$HTTP_STATUS" = "200" ] || [ "$PROXY_STATUS" = "200" ]; then
    echo "🎉 Cloudflare Functions are accessible!"
    echo ""
    echo "📚 How to use:"
    echo "  1. Start both servers: npm run dev:cf"
    echo "  2. Visit frontend: http://localhost:5173"
    echo "  3. API calls to /api/* will be proxied to Cloudflare Functions"
else
    echo "⚠️  Cloudflare Functions are not fully configured yet."
    echo ""
    echo "📚 To get started:"
    echo "  1. Make sure .dev.vars has your secrets"
    echo "  2. Run: npm run dev:cf"
    echo "  3. Wait for both servers to start"
    echo "  4. Run this test again"
fi