# Architecture Documentation

## Overview

This section contains all system architecture and design documentation for the Okaeri Resort Management System.

## Contents

### Core Architecture
- [**System Overview**](./system-overview.md) - High-level system architecture and technology stack
- [**API Architecture**](./api-architecture.md) - API design patterns and serverless function architecture

### Database Design
- [**Database Design**](./database-design.md) - Complete database schema with all tables and relationships
- [**Database ERD**](./database-erd.md) - Entity Relationship Diagram for visual understanding
- [**MVP Scope**](./mvp-scope.md) - Initial MVP database schema and scope definition

## Key Architectural Decisions

1. **Serverless-First**: Using Vercel and Neon PostgreSQL for auto-scaling and cost optimization
2. **Cost-Optimized**: Designed to run under $3/month using free tiers
3. **Mobile-First**: Optimized for Filipino mobile internet conditions
4. **Multi-tenant Ready**: Database schema supports multiple resort properties

## Technology Stack

- **Frontend**: React 19 + TypeScript + Vite + TanStack Router
- **Backend**: Vercel Serverless Functions
- **Database**: Neon PostgreSQL (serverless)
- **File Storage**: Cloudflare R2
- **State Management**: Zustand + TanStack Query
- **UI Framework**: shadcn/ui + Tailwind CSS v4

## Quick Links

- [Development Setup →](../02-development/getting-started/environment-setup.md)
- [Deployment Guide →](../03-deployment/production-setup.md)
- [Implementation Roadmap →](../04-releases/roadmap.md)