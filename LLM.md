# Captable, Inc. - LLM Context

## Overview
Captable, Inc. is an open-source cap table management platform designed as an alternative to Carta, Pulley, and AngelList. The platform provides comprehensive equity management, fundraising tools, and stakeholder communication features.

## Tech Stack
- **Framework**: Next.js 14 (App Router) with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **API**: tRPC for type-safe APIs
- **Authentication**: NextAuth with Passkey support
- **Styling**: Tailwind CSS with shadcn/ui components
- **Email**: React Email with Nodemailer
- **File Storage**: AWS S3 compatible (Minio for local dev)
- **Payments**: Stripe integration
- **PDF**: PDF-lib for generation, React-PDF for viewing
- **Queue**: pg-boss for job processing
- **Monitoring**: Sentry for error tracking

## Core Features

### 1. Cap Table Management
- **Share Classes**: Common and Preferred shares with customizable terms
- **Securities**: Shares, Options (ISO/NSO/RSU), SAFEs, Convertible Notes
- **Equity Plans**: Employee stock option plans with vesting schedules
- **Stakeholder Management**: Individual and institutional investors, employees, advisors

### 2. Fundraising Tools
- **SAFE Agreements**: YC standard templates (Post-money cap, discount, MFN variants)
- **Investment Tracking**: Record investments with share issuance
- **Convertible Notes**: Support for various types (CCD, OCD, NOTE)

### 3. Document Management
- **E-Signing**: Full document signing workflow with templates and fields
- **Data Rooms**: Secure document sharing with access controls
- **Document Storage**: Secure file uploads with S3-compatible storage

### 4. Communication
- **Investor Updates**: Rich-text updates with public/private sharing
- **Email Notifications**: Automated emails for various workflows

### 5. Compliance & Security
- **Audit Trail**: Comprehensive activity logging
- **RBAC**: Role-based access control with custom roles
- **Passkeys**: WebAuthn support for passwordless authentication
- **API Access**: Token-based API access for integrations

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── (authenticated)/    # Protected routes (dashboard, etc.)
│   ├── (unauthenticated)/ # Public routes (login, signup, etc.)
│   ├── (documents)/       # Document-related pages
│   └── api/               # API routes (auth, stripe, trpc)
├── components/            # React components organized by feature
├── server/               # Server-side utilities and services
├── trpc/                 # tRPC setup and routers
│   ├── api/             # API configuration
│   └── routers/         # Feature-specific routers
├── lib/                  # Utility functions and constants
├── providers/            # React context providers
├── hooks/               # Custom React hooks
├── emails/              # Email templates
├── jobs/                # Background job handlers
└── schema/              # Validation schemas
```

## Database Schema

### Core Entities
- **Company**: Central entity representing an organization
- **User**: System users with authentication
- **Member**: Company members with roles and permissions
- **Stakeholder**: Equity holders (investors, employees, etc.)

### Securities
- **ShareClass**: Define share types and terms
- **Share**: Issued shares with vesting
- **Option**: Stock options with exercise terms
- **Safe**: SAFE agreements
- **ConvertibleNote**: Convertible debt instruments
- **EquityPlan**: Stock option plans

### Documents
- **Document**: File storage references
- **Template**: E-sign document templates
- **TemplateField**: Form fields for e-signing
- **DataRoom**: Secure document collections

### Supporting
- **Audit**: Activity log entries
- **Update**: Investor updates
- **BankAccount**: Company bank accounts
- **Billing**: Stripe integration entities

## Key API Routes (tRPC)

### Authentication & Security
- `auth`: Login, signup, password reset
- `passkey`: WebAuthn registration/authentication
- `security`: Password management
- `accessToken`: API token management

### Company Management
- `company`: Company CRUD operations
- `member`: Team member management
- `rbac`: Role and permission management
- `bankAccounts`: Bank account management

### Securities Management
- `shareClass`: Share class configuration
- `equityPlan`: Equity plan management
- `securities`: Shares and options issuance
- `safe`: SAFE agreement management
- `stakeholder`: Stakeholder CRUD

### Documents & Communication
- `document`: File upload/management
- `template`: E-sign template management
- `templateField`: E-sign field configuration
- `dataRoom`: Data room management
- `update`: Investor update creation/sharing

### Other
- `audit`: Audit log access
- `billing`: Stripe subscription management
- `bucket`: File storage operations
- `common`: Shared utilities

## Development Patterns

### Authentication Flow
1. Uses NextAuth with custom adapters
2. Supports email/password and passkey authentication
3. Session-based authentication with JWT tokens
4. Member-based access control (users can be members of multiple companies)

### File Upload Pattern
1. Client requests presigned URL from bucket router
2. Direct upload to S3-compatible storage
3. Reference stored in database
4. Access controlled through application logic

### E-Signing Workflow
1. Upload PDF document
2. Create template with recipients
3. Add form fields (signature, text, date, etc.)
4. Send to recipients
5. Track signing progress
6. Generate completed document

### Background Jobs
Uses pg-boss for job queuing:
- Email sending (verification, invites, notifications)
- PDF generation for completed documents
- Async processing for heavy operations

## Environment Configuration

Key environment variables:
- `DATABASE_URL`: PostgreSQL connection
- `NEXTAUTH_URL/SECRET`: Authentication config
- `EMAIL_*`: SMTP configuration
- `UPLOAD_*`: S3-compatible storage config
- `STRIPE_*`: Payment processing
- `NEXT_PUBLIC_*`: Client-side variables

## Security Considerations

1. **Row-Level Security**: Enforced through Prisma queries with company/member context
2. **API Protection**: All tRPC procedures check authentication and authorization
3. **File Access**: Presigned URLs with expiration for secure file access
4. **Audit Trail**: Comprehensive logging of all significant actions
5. **Data Isolation**: Multi-tenant architecture with strict data separation

## Common Development Tasks

### Adding a New Feature
1. Define database schema in `prisma/schema.prisma`
2. Create tRPC router in `src/trpc/routers/`
3. Add to appRouter in `src/trpc/api/root.ts`
4. Build UI components in `src/components/`
5. Create pages in `src/app/`

### Working with Securities
1. Always check company context
2. Validate stakeholder relationships
3. Maintain audit trail for compliance
4. Handle vesting calculations properly

### Email Workflows
1. Create email template in `src/emails/`
2. Create job handler in `src/jobs/`
3. Register job in `src/jobs/register.ts`
4. Queue job from tRPC procedure

## Testing Considerations

- Use seeded data for development (see `prisma/seeds/`)
- Test multi-company scenarios
- Verify permission boundaries
- Check email delivery in Mailpit (local dev)

## Performance Optimizations

1. **Database**: Proper indexing on foreign keys and frequently queried fields
2. **File Storage**: Direct uploads to S3 bypass server
3. **Pagination**: Built into data tables and lists
4. **Caching**: React Query for client-side caching
5. **Background Jobs**: Heavy operations processed asynchronously

## Context for All AI Assistants

This file (`LLM.md`) is symlinked as:
- `.AGENTS.md`
- `CLAUDE.md`
- `QWEN.md`
- `GEMINI.md`

All files reference the same knowledge base. Updates here propagate to all AI systems.

## Rules for AI Assistants

1. **ALWAYS** update LLM.md with significant discoveries
2. **NEVER** commit symlinked files (.AGENTS.md, CLAUDE.md, etc.) - they're in .gitignore
3. **NEVER** create random summary files - update THIS file
