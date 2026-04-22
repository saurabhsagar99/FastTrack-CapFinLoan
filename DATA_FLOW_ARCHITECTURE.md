# Data Flow & Processing Pipeline - CapFinLoan

## 🗄️ DATA SOURCE (Where Data Comes From)

### 1. **Authentication Service - User Data**
```
SQL Server Database (auth schema)
        ↓
Users Table (User.Id, Email, Name, Role, IsActive)
        ↓
[Backend/AuthService/CapFinLoan.Auth.Persistence/Data/AuthDbContext.cs]
```

**File References:**
- **Database Context:** [Backend/AuthService/CapFinLoan.Auth.Persistence/Data/AuthDbContext.cs](Backend/AuthService/CapFinLoan.Auth.Persistence/Data/AuthDbContext.cs)
- **Domain Model:** [Backend/AuthService/CapFinLoan.Auth.Domain/Models/User.cs](Backend/AuthService/CapFinLoan.Auth.Domain/Models/User.cs)
- **Repository:** [Backend/AuthService/CapFinLoan.Auth.Persistence/Repositories/UserRepository.cs](Backend/AuthService/CapFinLoan.Auth.Persistence/Repositories/UserRepository.cs)

**Data Flow:**
```
AuthDbContext.Users (DbSet)
    ↓ (Query via LINQ)
UserRepository.GetByEmailAsync()
    ↓ (Returns User entity)
AuthService.LoginAsync()
    ↓ (Business logic - password validation, JWT generation)
AuthResponse DTO
    ↓ (HTTP Response)
AuthController.Login() → ApiResponse<AuthResponse>
```

---

### 2. **Application Service - Loan Application Data**
```
SQL Server Database (core schema)
        ↓
LoanApplications Table (Id, ApplicantId, LoanAmount, Status, etc.)
LoanApplicationSagaStates Table (Saga orchestration)
        ↓
[Backend/ApplicationService/CapFinLoan.Application.Persistence/Data/ApplicationDbContext.cs]
```

**File References:**
- **Database Context:** [Backend/ApplicationService/CapFinLoan.Application.Persistence/Data/ApplicationDbContext.cs](Backend/ApplicationService/CapFinLoan.Application.Persistence/Data/ApplicationDbContext.cs)
- **Domain Model:** [Backend/ApplicationService/CapFinLoan.Application.Domain/Models/LoanApplication.cs](Backend/ApplicationService/CapFinLoan.Application.Domain/Models/LoanApplication.cs)
- **Repository:** [Backend/ApplicationService/CapFinLoan.Application.Persistence/Repositories/ApplicationRepository.cs](Backend/ApplicationService/CapFinLoan.Application.Persistence/Repositories/ApplicationRepository.cs)

**Data Flow:**
```
ApplicationDbContext.LoanApplications (DbSet)
    ↓ (Query: Get by ID, Applicant ID, or All)
ApplicationRepository.GetByIdAsync()
    ↓ (Returns LoanApplication entity)
ApplicationService.CreateDraftAsync() / SubmitApplicationAsync()
    ↓ (Business logic - validation, status transition)
ApplicationResponseDto
    ↓ (HTTP Response)
ApplicationController.CreateDraft() → ApiResponse<ApplicationResponseDto>
    ↓ (Published to RabbitMQ)
ApplicationStatusChangedEvent
```

**LoanApplication Properties:**
```csharp
- Id (int, PK)
- ApplicantId (string, FK)
- ApplicantName, Email, Phone
- Address, DateOfBirth
- EmployerName, EmploymentType, MonthlyIncome
- LoanAmount, TenureMonths, LoanPurpose
- Status (Draft, Submitted, UnderReview, Approved, Rejected)
- StatusNote, CreatedAt, UpdatedAt
```

---

### 3. **Admin Service - Decision Data**
```
SQL Server Database (admin schema)
        ↓
Decisions Table (Id, ApplicationId, Status, Remarks, SanctionTerms)
Users Table (In-memory: Id, Name, Email, Role, IsActive)
        ↓
[Backend/AdminService/CapFinLoan.Admin.Persistence/Data/AdminDbContext.cs]
```

**File References:**
- **Database Context:** [Backend/AdminService/CapFinLoan.Admin.Persistence/Data/AdminDbContext.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Data/AdminDbContext.cs)
- **Domain Model:** [Backend/AdminService/CapFinLoan.Admin.Domain/Models/Decision.cs](Backend/AdminService/CapFinLoan.Admin.Domain/Models/Decision.cs)
- **Decision Repository:** [Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/DecisionRepository.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/DecisionRepository.cs)
- **User Repository:** [Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/UserRepository.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/UserRepository.cs) (In-memory)

**Data Flow:**
```
AdminDbContext.Decisions (DbSet - SQL Server)
    ↓ (Query: GetAll, GetByApplicationId, CountByStatus)
DecisionRepository.GetByApplicationIdAsync()
    ↓ (Returns Decision entity)
AdminService.MakeDecisionAsync()
    ↓ (Business logic - validate, update/create decision)
Decision object
    ↓ (Published to RabbitMQ)
AdminDecisionCreatedEvent
    ↓ (HTTP Response)
AdminController.MakeDecision() → ApiResponse<object>
```

**Decision Properties:**
```csharp
- Id (int, PK)
- ApplicationId (int, FK, Unique)
- AdminEmail (string)
- Status (Approved, Rejected, Pending)
- Remarks (string, max 1000)
- SanctionTerms (string, max 2000)
- DecisionDate (DateTime)
```

---

### 4. **Document Service - Document Metadata**
```
SQL Server Database (docs schema)
        ↓
Documents Table (Id, ApplicationId, FileName, FilePath, DocumentType, etc.)
        ↓
File Storage (Volume mount /app/uploads)
        ↓
[Backend/DocumentService/CapFinLoan.Document.Persistence/Data/DocumentDbContext.cs]
```

**File References:**
- **Database Context:** [Backend/DocumentService/CapFinLoan.Document.Persistence/Data/DocumentDbContext.cs](Backend/DocumentService/CapFinLoan.Document.Persistence/Data/DocumentDbContext.cs)
- **Domain Model:** [Backend/DocumentService/CapFinLoan.Document.Domain/Models/Document.cs](Backend/DocumentService/CapFinLoan.Document.Domain/Models/Document.cs)
- **Repository:** [Backend/DocumentService/CapFinLoan.Document.Persistence/Repositories/DocumentRepository.cs](Backend/DocumentService/CapFinLoan.Document.Persistence/Repositories/DocumentRepository.cs)

**Data Flow:**
```
DocumentDbContext.Documents (DbSet)
    ↓ (Query: Get by ApplicationId, Get by Id)
DocumentRepository.GetByApplicationIdAsync()
    ↓ (Returns DocumentEntity)
DocumentService.UploadDocumentAsync()
    ↓ (Validation: file type, size; Save to /app/uploads)
DocumentResponseDto
    ↓ (Published to RabbitMQ)
DocumentUploadedEvent
    ↓ (HTTP Response)
DocumentController.Upload() → ApiResponse<DocumentResponseDto>
```

**DocumentEntity Properties:**
```csharp
- Id (int, PK)
- ApplicationId (int, FK)
- UserId (string, FK)
- FileName (string, max 255)
- FilePath (string, max 500) - Physical file path
- FileType (string) - pdf, jpg, jpeg, png
- FileSize (long)
- DocumentType (string) - Aadhar, PAN, SalarySlip, etc.
- IsVerified (bool)
- VerificationRemarks (string)
- UploadedAt, VerifiedAt (DateTime)
```

---

## 📊 DATA PROCESSING PIPELINE

### **Complete Request-Response Cycle**

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                            │
│  UserDashboard.jsx / AdminDashboard.jsx                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                  API Request (HTTP)
                         │
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                  API GATEWAY (Ocelot)                           │
│  Port: 5047 - Routes to appropriate microservice               │
│  Authentication: JWT Bearer Token Validation                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ↓                    ↓                    ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ AUTH SERVICE │   │ APPLICATION  │   │ ADMIN SERVICE│
│  (Port 5194) │   │  (Port 5274) │   │  (Port 5293) │
└──────────────┘   └──────────────┘   └──────────────┘
    │                    │                    │
    ↓                    ↓                    ↓
┌────────────────────────────────────────────────────────────────┐
│                   CONTROLLER LAYER                             │
│  AuthController.Login()                                        │
│  ApplicationController.CreateDraft()                           │
│  AdminController.MakeDecision()                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER                                │
│  AuthService.LoginAsync()                                      │
│  ApplicationService.SubmitApplicationAsync()                   │
│  AdminService.MakeDecisionAsync()                              │
│                                                                │
│  → Business Logic                                              │
│  → Validation                                                  │
│  → Saga Orchestration                                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│              REPOSITORY LAYER (Data Access)                    │
│  UserRepository.GetByEmailAsync()                              │
│  ApplicationRepository.CreateAsync()                           │
│  DecisionRepository.AddAsync()                                 │
│  DocumentRepository.GetByApplicationIdAsync()                  │
│                                                                │
│  → CRUD Operations                                             │
│  → DbContext.SaveChangesAsync()                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│             DATABASE LAYER (SQL Server)                        │
│  auth.Users                                                    │
│  core.LoanApplications                                         │
│  core.LoanApplicationSagaStates                                │
│  admin.Decisions                                               │
│  docs.Documents                                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
                   Data Retrieved
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│            RESPONSE BUILDING & PUBLISHING                      │
│  1. Entity → DTO Mapping                                       │
│  2. ApiResponse<T> Wrapper                                     │
│  3. Event Publishing to RabbitMQ                               │
│  4. HTTP Response Serialization                                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ↓
┌────────────────────────────────────────────────────────────────┐
│                   MESSAGE BROKER (RabbitMQ)                    │
│  Topic Exchange: capfinloan.events                             │
│  Queues: auth_events, app_events, admin_events, doc_events    │
│                                                                │
│  Events Published:                                             │
│  - ApplicationStatusChangedEvent                               │
│  - ApplicationSubmittedEvent                                   │
│  - AdminDecisionCreatedEvent                                   │
│  - DocumentUploadedEvent                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ↓                    ↓                    ↓
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Consumer 1   │   │ Consumer 2   │   │ Consumer 3   │
│ Saga Handler │   │ Event Audit  │   │ Notification │
└──────────────┘   └──────────────┘   └──────────────┘
    │                    │                    │
    ↓                    ↓                    ↓
   Update DB        Log Events         Send Alerts
```

---

## 📁 KEY FILES BY LAYER

### **Layer 1: Database Context (Where SQL Server Connects)**
| Service | File | Table Schema |
|---------|------|--------------|
| Auth | [AuthDbContext.cs](Backend/AuthService/CapFinLoan.Auth.Persistence/Data/AuthDbContext.cs) | auth.Users |
| Application | [ApplicationDbContext.cs](Backend/ApplicationService/CapFinLoan.Application.Persistence/Data/ApplicationDbContext.cs) | core.LoanApplications, core.LoanApplicationSagaStates |
| Admin | [AdminDbContext.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Data/AdminDbContext.cs) | admin.Decisions |
| Document | [DocumentDbContext.cs](Backend/DocumentService/CapFinLoan.Document.Persistence/Data/DocumentDbContext.cs) | docs.Documents |

### **Layer 2: Domain Models (Data Structure)**
| Service | File | Entity |
|---------|------|--------|
| Auth | [User.cs](Backend/AuthService/CapFinLoan.Auth.Domain/Models/User.cs) | User (Id, Email, Name, Role) |
| Application | [LoanApplication.cs](Backend/ApplicationService/CapFinLoan.Application.Domain/Models/LoanApplication.cs) | LoanApplication (full loan details) |
| Admin | [Decision.cs](Backend/AdminService/CapFinLoan.Admin.Domain/Models/Decision.cs) | Decision (approval/rejection) |
| Document | [Document.cs](Backend/DocumentService/CapFinLoan.Document.Domain/Models/Document.cs) | DocumentEntity (file metadata) |

### **Layer 3: Repositories (Data Access)**
| Service | File | Methods |
|---------|------|---------|
| Auth | [UserRepository.cs](Backend/AuthService/CapFinLoan.Auth.Persistence/Repositories/UserRepository.cs) | GetByEmailAsync, UpdateAsync, GetAllAsync |
| Application | [ApplicationRepository.cs](Backend/ApplicationService/CapFinLoan.Application.Persistence/Repositories/ApplicationRepository.cs) | GetByIdAsync, GetByApplicantIdAsync, CreateAsync, UpdateAsync |
| Admin | [DecisionRepository.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/DecisionRepository.cs) | GetAllAsync, GetByApplicationIdAsync, AddAsync, UpdateAsync, CountByStatusAsync |
| Document | [DocumentRepository.cs](Backend/DocumentService/CapFinLoan.Document.Persistence/Repositories/DocumentRepository.cs) | AddAsync, GetByApplicationIdAsync, GetByIdAsync, UpdateAsync, DeleteAsync |

### **Layer 4: Services (Business Logic)**
| Service | File | Key Methods |
|---------|------|-------------|
| Auth | [AuthService.cs](Backend/AuthService/CapFinLoan.Auth.Application/Services/AuthService.cs) | LoginAsync, RegisterAsync |
| Application | [ApplicationService.cs](Backend/ApplicationService/CapFinLoan.Application.Application/Services/ApplicationService.cs) | CreateDraftAsync, SubmitApplicationAsync, ProcessSagaTransitionAsync |
| Admin | [AdminService.cs](Backend/AdminService/CapFinLoan.Admin.Application/Services/AdminService.cs) | MakeDecisionAsync, GetReportsSummaryAsync, GetApplicationQueueAsync |
| Document | [DocumentService.cs](Backend/DocumentService/CapFinLoan.Document.Application/Services/DocumentService.cs) | UploadDocumentAsync, VerifyDocumentAsync, GetDocumentsByApplicationAsync |

### **Layer 5: Controllers (HTTP API)**
| Service | File | Routes |
|---------|------|--------|
| Auth | [AuthController.cs](Backend/AuthService/CapFinLoan.Auth.API/Controllers/AuthController.cs) | POST /api/auth/login, POST /api/auth/register |
| Application | [ApplicationController.cs](Backend/ApplicationService/CapFinLoan.Application.API/Controllers/ApplicationController.cs) | POST /api/applications, PUT /api/applications/{id}, POST /api/applications/{id}/submit |
| Admin | [AdminController.cs](Backend/AdminService/CapFinLoan.Admin.API/Controllers/AdminController.cs), [DecisionsController.cs](Backend/AdminService/CapFinLoan.Admin.API/Controllers/DecisionsController.cs) | POST /api/admin/applications/{id}/decision, GET /api/admin/decisions/application/{id} |
| Document | [DocumentController.cs](Backend/DocumentService/CapFinLoan.Document.API/Controllers/DocumentController.cs) | POST /api/documents/upload, GET /api/documents/application/{id}, PUT /api/documents/{id}/verify |

### **Layer 6: DTOs (Data Transfer)**
| Service | File | Purpose |
|---------|------|---------|
| Auth | [AuthResponse.cs](Backend/AuthService/CapFinLoan.Auth.Application/DTOs/AuthResponse.cs) | JWT Token + User Info |
| Application | [CreateApplicationDto.cs](Backend/ApplicationService/CapFinLoan.Application.Application/DTOs/CreateApplicationDto.cs) | Request data |
| Admin | [DecisionDto.cs](Backend/AdminService/CapFinLoan.Admin.Application/DTOs/DecisionDto.cs) | Decision request |
| Document | [UploadDocumentDto.cs](Backend/DocumentService/CapFinLoan.Document.Application/DTOs/UploadDocumentDto.cs) | Upload request |

---

## 🔄 EXAMPLE: Data Flow for "Submit Loan Application"

```
1. FRONTEND (React)
   └─→ User clicks "Submit Application"
       └─→ POST /gateway/applications/{id}/submit
           └─→ JWT Token in Authorization header

2. API GATEWAY (Ocelot)
   └─→ Validates JWT
       └─→ Routes to ApplicationService:5274
           └─→ /api/applications/{id}/submit

3. CONTROLLER
   └─→ ApplicationController.SubmitApplication(id)
       └─→ Extracts applicantId from JWT claims
           └─→ Calls _applicationService.SubmitApplicationAsync(id, applicantId)

4. SERVICE
   └─→ ApplicationService.SubmitApplicationAsync()
       └─→ Fetches LoanApplication from database
           └─→ Validates: Status == Draft, All required fields filled
               └─→ Updates Status = "Submitted"
                   └─→ Creates LoanApplicationSagaState
                       └─→ Publishes ApplicationSubmittedEvent to RabbitMQ

5. REPOSITORY
   └─→ ApplicationRepository.UpdateAsync(application)
       └─→ _context.LoanApplications.Update(application)
           └─→ _context.SaveChangesAsync()
               └─→ SQL Server: UPDATE core.LoanApplications ...

6. DATABASE
   └─→ SQL Server stores updated record
       └─→ DecisionDate = NOW(), Status = "Submitted"
           └─→ Returns updated entity

7. MESSAGE BROKER (RabbitMQ)
   └─→ ApplicationSubmittedEvent published to Topic Exchange
       └─→ Admin Service Consumer receives event
           └─→ Creates notification
               └─→ Admin dashboard gets real-time update

8. RESPONSE
   └─→ ApiResponse<ApplicationResponseDto>.Ok(updatedApp, "Submitted successfully")
       └─→ HTTP 200
           └─→ JSON: { success: true, data: { id, status, ... } }
               └─→ FRONTEND updates UI with new status

9. FRONTEND
   └─→ Displays: "Application submitted for review"
       └─→ Shows new status badge
           └─→ Initiates polling for decision updates
```

---

## 🔐 Authentication & Authorization Data Flow

```
1. USER LOGIN
   └─→ POST /gateway/auth/login
       └─→ { email, password }

2. AUTH SERVICE
   └─→ UserRepository.GetByEmailAsync(email)
       └─→ Queries: auth.Users WHERE Email = @email
           └─→ Returns: User entity

3. VALIDATION
   └─→ AuthService.LoginAsync()
       └─→ Check: Password hash matches
           └─→ Check: IsActive == true
               └─→ If fails: Throw UnauthorizedAccessException

4. TOKEN GENERATION
   └─→ JwtService.GenerateTokenAsync(user)
       └─→ Creates Claims: sub, email, role, name
           └─→ Signs with Secret Key
               └─→ Expires in 24 hours

5. RESPONSE
   └─→ ApiResponse<AuthResponse>
       └─→ { token, userId, role, name, email }

6. CLIENT STORAGE
   └─→ Frontend stores: sessionStorage["capfinloan.session"]
       └─→ { token, role, userId, name }

7. SUBSEQUENT REQUESTS
   └─→ All API calls include: Authorization: Bearer {token}
       └─→ API Gateway validates token signature
           └─→ Extracts claims: userId, role
               └─→ Passes to microservice via header cloning
```

---

## 📊 Database Schema Summary

### **SQL Server - auth schema**
```sql
CREATE TABLE auth.Users (
    Id NVARCHAR(100) PRIMARY KEY,
    Email NVARCHAR(256) UNIQUE NOT NULL,
    PasswordHash NVARCHAR(MAX),
    Name NVARCHAR(150),
    Role NVARCHAR(20),
    IsActive BIT,
    CreatedAt DATETIME2
);
```

### **SQL Server - core schema**
```sql
CREATE TABLE core.LoanApplications (
    Id INT PRIMARY KEY IDENTITY,
    ApplicantId NVARCHAR(100),
    ApplicantName NVARCHAR(150),
    LoanAmount DECIMAL(18,2),
    Status NVARCHAR(50), -- Draft, Submitted, UnderReview, Approved, Rejected
    CreatedAt DATETIME2,
    UpdatedAt DATETIME2
);

CREATE TABLE core.LoanApplicationSagaStates (
    Id INT PRIMARY KEY IDENTITY,
    ApplicationId INT,
    Status NVARCHAR(100),
    CurrentStep NVARCHAR(100),
    CompletedSteps TEXT
);
```

### **SQL Server - admin schema**
```sql
CREATE TABLE admin.Decisions (
    Id INT PRIMARY KEY IDENTITY,
    ApplicationId INT UNIQUE,
    Status NVARCHAR(50), -- Approved, Rejected, Pending
    AdminEmail NVARCHAR(200),
    Remarks NVARCHAR(1000),
    SanctionTerms NVARCHAR(2000),
    DecisionDate DATETIME2
);
```

### **SQL Server - docs schema**
```sql
CREATE TABLE docs.Documents (
    Id INT PRIMARY KEY IDENTITY,
    ApplicationId INT,
    UserId NVARCHAR(100),
    FileName NVARCHAR(255),
    FilePath NVARCHAR(500),
    FileType NVARCHAR(50), -- pdf, jpg, png
    DocumentType NVARCHAR(50), -- Aadhar, PAN, SalarySlip
    IsVerified BIT,
    UploadedAt DATETIME2,
    VerifiedAt DATETIME2
);
```

---

## 🎯 Summary Table: Data Sources

| Data Type | Comes From | Stored In | Accessed By | Processing File |
|-----------|-----------|-----------|-------------|-----------------|
| **User Credentials** | Frontend Login Form | SQL Server (auth.Users) | AuthService | [UserRepository.cs](Backend/AuthService/CapFinLoan.Auth.Persistence/Repositories/UserRepository.cs) |
| **Loan Application** | Frontend Form Submission | SQL Server (core.LoanApplications) | ApplicationService | [ApplicationRepository.cs](Backend/ApplicationService/CapFinLoan.Application.Persistence/Repositories/ApplicationRepository.cs) |
| **Admin Decision** | Admin Panel Decision Form | SQL Server (admin.Decisions) | AdminService | [DecisionRepository.cs](Backend/AdminService/CapFinLoan.Admin.Persistence/Repositories/DecisionRepository.cs) |
| **Document Files** | Frontend File Upload | /app/uploads (Volume) + SQL Server (docs.Documents) | DocumentService | [DocumentRepository.cs](Backend/DocumentService/CapFinLoan.Document.Persistence/Repositories/DocumentRepository.cs) |
| **Inter-Service Messages** | Microservices (Events) | RabbitMQ (Message Queue) | All Services (Consumers) | [RabbitMqPublisher.cs](Backend/ApplicationService/CapFinLoan.Application.Application/Services/RabbitMqPublisher.cs) |

