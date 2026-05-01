# NUnit Testing Framework - CapFinLoan Microservices

This document provides an overview of the NUnit testing implementation across all 4 microservices.

## Project Structure

```
AuthService/
├── CapFinLoan.Auth.Tests/
│   ├── CapFinLoan.Auth.Tests.csproj
│   └── Services/
│       ├── AuthServiceTests.cs
│       └── JwtServiceTests.cs

ApplicationService/
├── CapFinLoan.Application.Tests/
│   ├── CapFinLoan.Application.Tests.csproj
│   └── Services/
│       └── ApplicationServiceTests.cs

AdminService/
├── CapFinLoan.Admin.Tests/
│   ├── CapFinLoan.Admin.Tests.csproj
│   └── Services/
│       └── AdminServiceTests.cs

DocumentService/
├── CapFinLoan.Document.Tests/
│   ├── CapFinLoan.Document.Tests.csproj
│   └── Services/
│       └── DocumentServiceTests.cs
```

## Test Framework & Tools

- **NUnit 4.1.0** - Testing framework
- **NUnit3TestAdapter 4.5.0** - Test adapter for Visual Studio
- **Moq 4.20.70** - Mocking library for creating test doubles
- **.NET 8.0** - Target framework

## Running Tests

### All Tests
```bash
dotnet test Backend/
```

### Individual Service Tests
```bash
# Auth Service tests
dotnet test Backend/AuthService/CapFinLoan.Auth.Tests

# Application Service tests
dotnet test Backend/ApplicationService/CapFinLoan.Application.Tests

# Admin Service tests
dotnet test Backend/AdminService/CapFinLoan.Admin.Tests

# Document Service tests
dotnet test Backend/DocumentService/CapFinLoan.Document.Tests
```

### With Detailed Output
```bash
dotnet test Backend/ --logger "console;verbosity=detailed"
```

## Test Coverage

### AuthService Tests (`CapFinLoan.Auth.Tests`)

#### AuthServiceTests
- ✅ **LoginAsync_WithValidCredentials_ReturnsAuthResponseDto** - Validates successful login with correct credentials
- ✅ **LoginAsync_WithInvalidEmail_ThrowsUnauthorizedAccessException** - Ensures non-existent email is rejected
- ✅ **LoginAsync_WithInvalidPassword_ThrowsUnauthorizedAccessException** - Ensures wrong password is rejected
- ✅ **LoginAsync_WithInactiveUser_ThrowsUnauthorizedAccessException** - Prevents login for deactivated users
- ✅ **RegisterAsync_WithValidData_CreatesUserAndPublishesEvent** - Tests user registration with event publishing
- ✅ **RegisterAsync_WithExistingEmail_ThrowsInvalidOperationException** - Prevents duplicate email registration

#### JwtServiceTests
- ✅ **GenerateToken_WithValidUser_ReturnsValidJwtToken** - Validates JWT token generation
- ✅ **GenerateToken_WithDifferentUsers_GeneratesDifferentTokens** - Ensures unique tokens per user
- ✅ **GenerateToken_IncludesUserClaimsInToken** - Verifies claims are included in token

### ApplicationService Tests (`CapFinLoan.Application.Tests`)

#### ApplicationServiceTests
- ✅ **CreateDraftAsync_WithValidData_ReturnsDraftApplication** - Tests draft creation
- ✅ **UpdateDraftAsync_WithValidData_UpdatesApplication** - Tests draft updates
- ✅ **UpdateDraftAsync_WithUnauthorizedUser_ReturnsFail** - Prevents unauthorized updates
- ✅ **SubmitApplicationAsync_WithCompleteData_SubmitsSuccessfully** - Tests application submission with saga trigger
- ✅ **SubmitApplicationAsync_WithIncompleteData_ReturnsFail** - Validates required fields before submission

### AdminService Tests (`CapFinLoan.Admin.Tests`)

#### AdminServiceTests
- ✅ **MakeDecisionAsync_WithApprovedStatus_PublishesDecisionEvent** - Tests approval decision flow
- ✅ **MakeDecisionAsync_WithRejectedStatus_PublishesDecisionEvent** - Tests rejection decision flow
- ✅ **MakeDecisionAsync_UpdatesExistingDecision** - Tests decision updates
- ✅ **GetReportsSummaryAsync_ReturnsSummaryWithCounts** - Tests report generation
- ✅ **GetApplicationQueueAsync_ReturnsDecisions** - Tests queue retrieval

### DocumentService Tests (`CapFinLoan.Document.Tests`)

#### DocumentServiceTests
- ✅ **UploadDocumentAsync_WithValidPdfFile_SavesAndReturnsDto** - Tests successful document upload
- ✅ **UploadDocumentAsync_WithInvalidFileType_ThrowsInvalidOperationException** - Validates file type restrictions
- ✅ **UploadDocumentAsync_WithFileTooLarge_ThrowsInvalidOperationException** - Enforces file size limits (5 MB)
- ✅ **VerifyDocumentAsync_WithValidVerification_MarksDocumentAsVerified** - Tests document verification
- ✅ **VerifyDocumentAsync_WithRejectionNoRemarks_ThrowsInvalidOperationException** - Requires remarks for rejection
- ✅ **GetDocumentsByApplicationAsync_ReturnsListOfDocuments** - Tests document retrieval

## Key Testing Patterns

### 1. **Arrange-Act-Assert (AAA)**
All tests follow the AAA pattern for clarity:
```csharp
[Test]
public async Task TestMethod()
{
    // Arrange - Set up test data and mocks
    var mockRepo = new Mock<IRepository>();
    
    // Act - Execute the method being tested
    var result = await service.MethodAsync();
    
    // Assert - Verify the results
    Assert.That(result, Is.Not.Null);
}
```

### 2. **Mocking with Moq**
Dependencies are mocked to isolate units under test:
```csharp
_mockRepository.Setup(r => r.GetByIdAsync(id))
    .ReturnsAsync(expectedObject);
```

### 3. **Verification**
Verify method calls and interaction counts:
```csharp
_mockRepository.Verify(r => r.AddAsync(It.IsAny<Entity>()), Times.Once);
```

## Adding New Tests

To add tests for a new service:

1. Create test class in appropriate service test project
2. Use `[TestFixture]` attribute on class
3. Mark test methods with `[Test]` attribute
4. Use `[SetUp]` for initialization (runs before each test)
5. Follow AAA pattern
6. Use Moq for mocking dependencies

Example:
```csharp
[TestFixture]
public class MyServiceTests
{
    private Mock<IDependency> _mockDep;
    private MyService _service;

    [SetUp]
    public void Setup()
    {
        _mockDep = new Mock<IDependency>();
        _service = new MyService(_mockDep.Object);
    }

    [Test]
    public async Task MyMethod_WithCondition_ReturnsExpected()
    {
        // Arrange
        _mockDep.Setup(d => d.MethodAsync()).ReturnsAsync(expectedValue);

        // Act
        var result = await _service.MyMethod();

        // Assert
        Assert.That(result, Is.EqualTo(expectedValue));
    }
}
```

## Best Practices

✅ **Do's:**
- Write focused tests that test one thing
- Use descriptive test names following `MethodName_Condition_ExpectedBehavior` pattern
- Mock external dependencies
- Use `[SetUp]` for common initialization
- Keep test data realistic but minimal
- Test both happy path and error cases

❌ **Don'ts:**
- Don't test implementation details
- Don't use real databases in unit tests
- Don't create test interdependencies
- Don't write overly complex assertions
- Don't ignore test failures

## Continuous Integration

To integrate tests in CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Run tests
  run: dotnet test Backend/ --logger "trx" --collect:"XPlat Code Coverage"
```

## Test Metrics

Currently implemented:
- **27 unit tests** across 4 services
- **High isolation** using Moq for all external dependencies
- **Service-level testing** for business logic validation
- **Integration point testing** for event publishing

## Future Enhancements

- [ ] Integration tests with test database
- [ ] Controller-level tests (API endpoint validation)
- [ ] Repository tests with EF Core In-Memory
- [ ] RabbitMQ message consumer tests
- [ ] Code coverage reports (>80% target)
- [ ] Performance/load testing

---

**Last Updated:** April 2026
**Maintainer:** Development Team
