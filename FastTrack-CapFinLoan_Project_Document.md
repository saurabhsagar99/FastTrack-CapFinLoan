# FastTrack-CapFinLoan Project Document

## 1. PROJECT SUMMARY
FastTrack-CapFinLoan is a **microservices-based digital loan management platform** that streamlines the complete loan application lifecycle from user registration through document submission, admin review, and decision-making. Built with .NET 10 and React, the system processes loan applications with automated workflow orchestration and multi-document verification requirements.

## 2. ARCHITECTURE

### 2.1 High-Level Architecture
- **Pattern**: Microservices architecture with event-driven communication
- **API Gateway**: Ocelot (routes requests to appropriate services)
- **Message Broker**: RabbitMQ (event bus for inter-service communication)
- **Database**: 4 isolated SQL Server databases (one per service)
- **Deployment**: Docker containerized with docker-compose orchestration

### 2.2 System Topology
```
React Frontend (Vite)
        ↓
API Gateway (Ocelot) - http://localhost:5047
        ↓
    ┌───┴───┬───────┬──────────┐
    ↓       ↓       ↓          ↓
  Auth   Application  Admin   Document
  API      API       API       API
(5251)   (5008)    (5094)   (5003)
    ↓       ↓       ↓          ↓
AuthDb  AppDb   AdminDb    DocumentDb
            ↓
        RabbitMQ
      Event Bus
```

## 3. BACKEND SERVICES

### 3.1 Authentication Service
**Location**: Backend/AuthService  
**Port**: 5251 (or 8080 in Docker)

**Responsibilities**:
- User registration and login
- JWT token generation and validation
- User management and status toggling
- Authentication middleware integration

**Database**: `CapFinLoanAuthDb`

**Key Endpoints**:
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Authenticate user, return JWT token
- `GET /api/users` - Get all users (admin)
- `PATCH /api/users/{id}/status` - Toggle user active/inactive status

**Technology Stack**:
- .NET 10
- Entity Framework Core with SQL Server
- JWT (HS256 signing)
- ASP.NET Core Identity patterns

### 3.2 Application Service
**Location**: Backend/ApplicationService  
**Port**: 5008 (or 8080 in Docker)

**Responsibilities**:
- Loan application lifecycle management (Draft → Submitted → UnderReview → Approved/Rejected)
- Application submission orchestration
- Saga pattern implementation for distributed workflow
- Status updates triggered by document and admin events

**Database**: `CapFinLoanApplicationDb`

**Key Endpoints**:
- `GET /api/applications/my` - Get current user's applications
- `GET /api/applications/{id}` - Get application details
- `POST /api/applications` - Create draft application
- `PUT /api/applications/{id}` - Update draft application
- `POST /api/applications/{id}/submit` - Submit application for review
- `GET /api/applications/{id}/status` - Get application status with details
- `PATCH /api/applications/{id}/status` - Update application status (admin-only)

**Data Model**:
```csharp
LoanApplication {
  Id: int,
  ApplicantId: string (FK to User),
  ApplicantName, Email, Phone, Address,
  DateOfBirth, EmployerName, EmploymentType,
  MonthlyIncome: decimal,
  LoanAmount: decimal,
  TenureMonths: int,
  LoanPurpose: string,
  Status: Draft | Submitted | UnderReview | Approved | Rejected,
  StatusNote: string,
  CreatedAt, UpdatedAt, SubmittedAt: DateTime
}
```

**Saga Orchestration**:
- Consumes: `document.status.updated`, `admin.decision.created` events
- Publishes: `application.status.changed` events
- Maintains saga state in `LoanApplicationSagaStates` table

### 3.3 Admin Service
**Location**: Backend/AdminService  
**Port**: 5094 (or 8080 in Docker)

**Responsibilities**:
- Loan application review queue management
- Make approval/rejection decisions with sanction terms
- Generate loan processing reports and summaries
- User management (admin users only)

**Database**: `CapFinLoanAdminDb`

**Key Endpoints**:
- `GET /api/admin/queue` - Get applications pending review
- `POST /api/admin/decisions` - Record admin decision (approve/reject)
- `GET /api/decisions/{applicationId}` - Get decision for application
- `GET /api/reports/summary` - Get loan processing summary
- `GET /api/users` - List all system users
- `PATCH /api/users/{id}/status` - Toggle user status

**Decision Model**:
```csharp
Decision {
  Id: int,
  ApplicationId: int (FK),
  AdminEmail: string,
  Status: Approved | Rejected,
  Remarks: string,
  SanctionTerms: string (loan terms if approved),
  DecisionDate: DateTime
}
```

**Reports**:
- Total applications processed
- Approved vs. rejected counts
- Average processing time
- Status distribution

### 3.4 Document Service
**Location**: Backend/DocumentService  
**Port**: 5003 (or 8080 in Docker)

**Responsibilities**:
- Document upload and storage management
- Document verification by admin
- Required documents checklist tracking
- File serving and deletion

**Database**: `CapFinLoanDocumentDb`  
**File Storage**: `/app/uploads` directory

**Key Endpoints**:
- `POST /api/documents/upload` - Upload document with form-data
- `GET /api/documents/application/{applicationId}` - Get all documents for application
- `GET /api/documents/application/{applicationId}/required` - Get required documents checklist
- `PATCH /api/documents/{docId}/verify` - Verify document (admin)
- `GET /api/documents/{docId}/download` - Download document
- `DELETE /api/documents/{docId}` - Delete document

**Required Documents** (4-document requirement):
1. **KYC Document** - Aadhar/PAN Card
2. **Address Proof** - Utility bill, rent agreement
3. **Income Proof** - Salary slip, tax return
4. **Bank Statement** - Recent bank statement

**Document Model**:
```csharp
Document {
  Id: int,
  ApplicationId: int (FK),
  UserId: string (FK),
  FileName: string,
  FilePath: string,
  FileType: string (MIME type),
  FileSize: long,
  DocumentType: enum (KYC, AddressProof, IncomeProof, BankStatement),
  IsRequired: bool,
  IsVerified: bool,
  VerificationRemarks: string,
  UploadedAt, VerifiedAt: DateTime
}
```

**Checklist Endpoint Response**:
```json
{
  "requiredDocuments": [
    {
      "documentType": "KYC",
      "isUploaded": true,
      "isVerified": false,
      "uploadedAt": "2026-05-10T10:30:00Z"
    }
  ],
  "allRequiredDocumentsUploaded": false
}
```

### 3.5 API Gateway (Ocelot)
**Location**: Backend/ApiGateway  
**Port**: 5047

**Responsibilities**:
- Single entry point for all frontend requests
- JWT authentication and token validation
- Request routing to appropriate microservice
- CORS policy enforcement

**Route Configuration**:
- `/api/auth/*` → Auth Service (5251)
- `/api/applications/*` → Application Service (5008)
- `/api/admin/*` → Admin Service (5094)
- `/api/documents/*` → Document Service (5003)

**Security**:
- JWT Bearer token validation
- HS256 signing with shared secret
- CORS allowed for `http://localhost:5173` (frontend)

## 4. FRONTEND

**Location**: Frontend  
**Framework**: React 19 + Vite  
**Port**: 5173 (dev) / 5173 (production via Nginx)

### 4.1 Pages & Routes
- `/login` - User login page
- `/signup` - User registration page
- `/dashboard` - Applicant dashboard (protected)
  - View applications
  - Create new draft
  - Upload documents
  - Track status
- `/admin` - Admin dashboard (role-based, admin users only)
  - Review applications queue
  - Make approval/rejection decisions
  - View reports

### 4.2 Frontend Structure
```
src/
├── pages/
│   ├── LoginPage.jsx
│   ├── SignupPage.jsx
│   ├── UserDashboard.jsx
│   └── AdminDashboard.jsx
├── components/
│   ├── HeaderBar.jsx
│   ├── Protected.jsx (Auth guard)
│   └── PublicOnly.jsx (Public route guard)
├── utils/
│   └── appUtils.js (API calls, session management)
├── App.jsx (Router setup)
└── main.jsx (Entry point)
```

### 4.3 Technologies
- **React 19.2.4** - UI library
- **React Router DOM 7.13.2** - Client-side routing
- **Vite 8.0.1** - Build tool with HMR
- **Testing**: Vitest, @testing-library/react
- **Linting**: ESLint with React plugins
- **Compiler**: React Compiler enabled for optimization

### 4.4 Session Management
- JWT stored in sessionStorage (key: `SESSION_KEY`)
- Session contains: `userId`, `email`, `role`, `token`
- Cross-tab logout detection via storage events
- Role-based routing guards

## 5. EVENT-DRIVEN COMMUNICATION (RabbitMQ)

### 5.1 Events
1. **`application.submitted`** (Published by Application Service)
   - Triggered when applicant submits application
   - Consumed by: Admin Service, Document Service
   
2. **`document.status.updated`** (Published by Document Service)
   - Triggered when admin verifies documents
   - Consumed by: Application Service (for saga progress)
   
3. **`admin.decision.created`** (Published by Admin Service)
   - Triggered when admin makes approval/rejection decision
   - Consumed by: Application Service (to update final status)

### 5.2 Saga Workflow
```
User Submits Application
        ↓
Publish: application.submitted
        ↓
Admin Service & Document Service receive event
        ↓
Application moves to: "UnderReview" status
        ↓
[Parallel: Admin reviews, Documents verified]
        ↓
Document Verified → Publish: document.status.updated
Admin Decision → Publish: admin.decision.created
        ↓
Application Service consumes both events
        ↓
Update final status: "Approved" or "Rejected"
        ↓
Publish: application.status.changed
```

## 6. DATABASE SCHEMA

### 6.1 Core Tables (Shared Across Services)

**Users** (Auth Service)
- Id (GUID/PK)
- Email (unique)
- PasswordHash
- Name, Phone, Role, IsActive
- CreatedAt

**LoanApplications** (Application Service)
- Id (PK)
- ApplicantId (FK → Users)
- Personal info: Name, Email, Phone, DOB, Address
- Financial info: EmployerName, EmploymentType, MonthlyIncome
- Loan details: LoanAmount, TenureMonths, LoanPurpose
- Status, StatusNote
- CreatedAt, UpdatedAt, SubmittedAt

**Documents** (Document Service)
- Id (PK)
- ApplicationId (FK), UserId (FK)
- FileName, FilePath, FileType, FileSize
- DocumentType (enum: KYC, AddressProof, IncomeProof, BankStatement)
- IsRequired, IsVerified
- VerificationRemarks, UploadedAt, VerifiedAt

**Decisions** (Admin Service)
- Id (PK)
- ApplicationId (FK), AdminEmail
- Status (Approved/Rejected)
- Remarks, SanctionTerms
- DecisionDate

**LoanApplicationSagaStates** (Application Service)
- Id (PK)
- ApplicationId (FK)
- CurrentStep, LastEventName, LastMessage

## 7. KEY FEATURES

### 7.1 User Management
- ✅ User registration with email/password
- ✅ JWT-based authentication
- ✅ Role-based access control (User/Admin)
- ✅ Admin can activate/deactivate users

### 7.2 Loan Application Workflow
- ✅ Create draft application (multiple applications per user)
- ✅ Edit draft before submission
- ✅ Submit for review (triggering saga workflow)
- ✅ Status tracking: Draft → Submitted → UnderReview → Approved/Rejected
- ✅ Status notes/remarks for applicant feedback

### 7.3 Document Management
- ✅ Upload 4 required documents (KYC, Address Proof, Income Proof, Bank Statement)
- ✅ Multiple documents per type support
- ✅ Admin document verification with remarks
- ✅ Checklist showing upload/verification status
- ✅ Document download capability
- ✅ File storage in Docker volume

### 7.4 Admin Review & Decision
- ✅ Queue of pending applications
- ✅ View application details and uploaded documents
- ✅ Approve/reject with sanction terms or remarks
- ✅ Admin reporting dashboard
- ✅ Summary statistics (total, approved, rejected, average processing time)

### 7.5 Async Processing
- ✅ Event-driven saga orchestration
- ✅ Eventual consistency across services
- ✅ Resilient to service failures
- ✅ Proper error handling and logging

## 8. TECHNOLOGIES STACK

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | ASP.NET Core | .NET 10 |
| Language | C# | 12+ |
| ORM | Entity Framework Core | Latest |
| API Gateway | Ocelot | Latest |
| Message Queue | RabbitMQ | 3-management |
| Database | SQL Server | 2022 |
| Authentication | JWT (HS256) | Standard |
| Testing | NUnit | 4.1.0 |
| Mocking | Moq | 4.20.70 |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 19.2.4 |
| Routing | React Router DOM | 7.13.2 |
| Build Tool | Vite | 8.0.1 |
| Testing | Vitest | 4.1.5 |
| Test Utils | @testing-library/react | 16.3.2 |
| Linting | ESLint | 9.39.4 |

### DevOps
- Docker containerization
- docker-compose for local orchestration
- Nginx reverse proxy (frontend)
- SQL Server container with persistent volumes
- RabbitMQ container with management UI

## 9. DEPLOYMENT & STARTUP

### 9.1 Local Development (Docker)
```bash
docker-compose up -d
```

**Service URLs**:
- Frontend: http://localhost:5173
- API Gateway: http://localhost:5047
- Auth Service: http://localhost:5251
- Application Service: http://localhost:5008
- Admin Service: http://localhost:5094
- Document Service: http://localhost:5003
- SQL Server: localhost:1433 (sa / CapFinLoan@12345)
- RabbitMQ: http://localhost:15672 (guest / guest)

### 9.2 Launch Profiles
Profile "New Profile" starts all 5 APIs:
- CapFinLoan.Auth.API
- CapFinLoan.Application.API
- CapFinLoan.Gateway.API
- CapFinLoan.Admin.API
- CapFinLoan.Document.API

### 9.3 Testing

#### Backend Testing
```bash
# Run all backend tests
dotnet test Backend/

# Run service-specific tests
dotnet test Backend/AuthService/CapFinLoan.Auth.Tests/
dotnet test Backend/ApplicationService/CapFinLoan.Application.Tests/
dotnet test Backend/AdminService/CapFinLoan.Admin.Tests/
dotnet test Backend/DocumentService/CapFinLoan.Document.Tests/
```

#### Frontend Testing
```bash
# Run frontend unit tests
npm run test
```

## 10. CLEAN ARCHITECTURE LAYERS

Each microservice follows Clean Architecture:

```
Service.API/
  ├── Controllers/ (HTTP entry points)
  ├── Middleware/ (Exception handling, auth)
  ├── Extensions/ (DI configuration)
  └── Program.cs

Service.Application/
  ├── Services/ (Business logic)
  ├── DTOs/ (Data transfer objects)
  └── Interfaces/

Service.Domain/
  ├── Entities/ (Core domain models)
  ├── Enums/
  └── Interfaces/

Service.Persistence/
  ├── Data/ (DbContext)
  ├── Repositories/ (Data access)
  └── Migrations/

Service.Infrastructure/
  ├── Messaging/ (RabbitMQ consumers/publishers)
  └── External services/
```

## 11. KEY DESIGN PATTERNS

| Pattern | Purpose | Implementation |
|---------|---------|-----------------|
| **Repository Pattern** | Abstract data access | Generic repository interfaces |
| **Dependency Injection** | Loose coupling | Constructor injection in services |
| **Saga Pattern** | Distributed transactions | State machine for multi-step workflows |
| **Pub-Sub (Event Bus)** | Inter-service communication | RabbitMQ topics |
| **DTO Pattern** | API contracts | Separation of domain/API models |
| **Authentication** | Security | JWT with HS256 signing |
| **Clean Architecture** | Separation of concerns | Layered structure per service |

## 12. SECURITY FEATURES

- ✅ JWT token-based authentication
- ✅ Role-based authorization (User/Admin)
- ✅ Password hashing (SecurePasswordHasher)
- ✅ CORS policy enforcement
- ✅ Token expiration validation
- ✅ Protected API endpoints via [Authorize] attribute
- ✅ Frontend route guards (Protected/PublicOnly components)

## 13. DOCUMENTATION ARTIFACTS

- architecture-diagram.mmd - System architecture flowchart
- database-diagram.mmd - Database ER diagram
- DATA_FLOW_ARCHITECTURE.md - Detailed data flow documentation
- MULTI_DOCUMENT_IMPLEMENTATION.md - 4-document requirement details
- TESTING.md - NUnit testing framework overview

## 14. PROJECT STATUS

✅ **Completed Features**:
- 4-microservice architecture with event bus
- Multi-document loan application workflow
- Admin review and decision-making system
- JWT authentication with role-based access
- React frontend with routing
- Docker containerization
- Saga pattern implementation
- NUnit test suite

🔄 **In Development/Future Enhancements**:
- Additional loan product variations
- Advanced reporting analytics
- Document OCR/verification automation
- Email notifications
- SMS alerts
- Mobile app support