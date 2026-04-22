using NUnit.Framework;
using Moq;
using CapFinLoan.Application.Application.Common;
using CapFinLoan.Application.Application.DTOs;
using CapFinLoan.Application.Application.Interfaces;
using CapFinLoan.Application.Application.Services;
using CapFinLoan.Application.Domain.Enums;
using CapFinLoan.Application.Domain.Models;
using CapFinLoan.Application.Persistence;
using CapFinLoan.Application.Persistence.Repositories;

namespace CapFinLoan.Application.Tests.Services;

[TestFixture]
public class ApplicationServiceTests
{
    private Mock<IApplicationRepository>? _mockRepository;
    private Mock<ILoanApplicationSagaRepository>? _mockSagaRepository;
    private Mock<IMessagePublisher>? _mockMessagePublisher;
    private ApplicationService? _applicationService;

    [SetUp]
    public void Setup()
    {
        _mockRepository = new Mock<IApplicationRepository>();
        _mockSagaRepository = new Mock<ILoanApplicationSagaRepository>();
        _mockMessagePublisher = new Mock<IMessagePublisher>();

        _applicationService = new ApplicationService(
            _mockRepository.Object,
            _mockSagaRepository.Object,
            _mockMessagePublisher.Object);
    }

    [Test]
    public async Task CreateDraftAsync_WithValidData_ReturnsDraftApplication()
    {
        // Arrange
        var applicantId = "user123";
        var createDto = new CreateApplicationDto
        {
            ApplicantName = "John Doe",
            ApplicantEmail = "john@example.com",
            Phone = "9876543210",
            Address = "123 Main St",
            DateOfBirth = new DateTime(1990, 1, 1),
            EmployerName = "Tech Corp",
            EmploymentType = "Full-time",
            MonthlyIncome = 50000m,
            LoanAmount = 300000m,
            TenureMonths = 60,
            LoanPurpose = "Home Loan"
        };

        var expectedApplication = new LoanApplication
        {
            Id = 1,
            ApplicantId = applicantId,
            ApplicantName = createDto.ApplicantName,
            ApplicantEmail = createDto.ApplicantEmail,
            Status = ApplicationStatus.Draft,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockRepository.Setup(r => r.CreateAsync(It.IsAny<LoanApplication>()))
            .ReturnsAsync(expectedApplication);

        // Act
        var result = await _applicationService.CreateDraftAsync(applicantId, createDto);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Success, Is.True);
        Assert.That(result.Data.Status, Is.EqualTo(ApplicationStatus.Draft.ToString()));
        _mockRepository!.Verify(r => r.CreateAsync(It.IsAny<LoanApplication>()), Times.Once);
    }

    [Test]
    public async Task UpdateDraftAsync_WithValidData_UpdatesApplication()
    {
        // Arrange
        var applicationId = 1;
        var applicantId = "user123";
        var updateDto = new UpdateApplicationDto
        {
            ApplicantName = "Updated Name",
            LoanAmount = 400000m
        };

        var existingApp = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = applicantId,
            Status = ApplicationStatus.Draft,
            ApplicantName = "Old Name",
            LoanAmount = 300000m
        };

        var updatedApp = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = applicantId,
            Status = ApplicationStatus.Draft,
            ApplicantName = "Updated Name",
            LoanAmount = 400000m
        };

        _mockRepository.Setup(r => r.GetByIdAsync(applicationId))
            .ReturnsAsync(existingApp);

        _mockRepository.Setup(r => r.UpdateAsync(It.IsAny<LoanApplication>()))
            .ReturnsAsync(updatedApp);

        // Act
        var result = await _applicationService.UpdateDraftAsync(applicationId, applicantId, updateDto);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Success, Is.True);
        Assert.That(result.Data.LoanAmount, Is.EqualTo(400000m));
        _mockRepository!.Verify(r => r.UpdateAsync(It.IsAny<LoanApplication>()), Times.Once);
    }

    [Test]
    public async Task UpdateDraftAsync_WithUnauthorizedUser_ReturnsFail()
    {
        // Arrange
        var applicationId = 1;
        var applicantId = "user123";
        var differentUserId = "user456";
        var updateDto = new UpdateApplicationDto { ApplicantName = "New Name" };

        var existingApp = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = differentUserId,
            Status = ApplicationStatus.Draft
        };

        _mockRepository.Setup(r => r.GetByIdAsync(applicationId))
            .ReturnsAsync(existingApp);

        // Act
        var result = await _applicationService.UpdateDraftAsync(applicationId, applicantId, updateDto);

        // Assert
        Assert.That(result.Success, Is.False);
        Assert.That(result.Message, Contains.Substring("not authorised"));
    }

    [Test]
    public async Task SubmitApplicationAsync_WithCompleteData_SubmitsSuccessfully()
    {
        // Arrange
        var applicationId = 1;
        var applicantId = "user123";

        var application = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = applicantId,
            Status = ApplicationStatus.Draft,
            EmployerName = "Tech Corp",
            MonthlyIncome = 50000m,
            LoanAmount = 300000m,
            TenureMonths = 60,
            LoanPurpose = "Home Loan"
        };

        var submittedApp = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = applicantId,
            Status = ApplicationStatus.Submitted,
            SubmittedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _mockRepository.Setup(r => r.GetByIdAsync(applicationId))
            .ReturnsAsync(application);

        _mockRepository.Setup(r => r.UpdateAsync(It.IsAny<LoanApplication>()))
            .ReturnsAsync(submittedApp);

        _mockSagaRepository!.Setup(r => r.UpsertAsync(It.IsAny<LoanApplicationSagaState>()))
            .ReturnsAsync(new LoanApplicationSagaState());

        _mockMessagePublisher.Setup(p => p.PublishApplicationStatusChangedAsync(It.IsAny<ApplicationStatusChangedEvent>()))
            .Returns(Task.CompletedTask);

        _mockMessagePublisher.Setup(p => p.PublishApplicationSubmittedAsync(It.IsAny<ApplicationStatusChangedEvent>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _applicationService.SubmitApplicationAsync(applicationId, applicantId);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Success, Is.True);
        _mockRepository!.Verify(r => r.UpdateAsync(It.IsAny<LoanApplication>()), Times.Once);
        _mockSagaRepository!.Verify(r => r.UpsertAsync(It.IsAny<LoanApplicationSagaState>()), Times.Once);
    }

    [Test]
    public async Task SubmitApplicationAsync_WithIncompleteData_ReturnsFail()
    {
        // Arrange
        var applicationId = 1;
        var applicantId = "user123";

        var application = new LoanApplication
        {
            Id = applicationId,
            ApplicantId = applicantId,
            Status = ApplicationStatus.Draft,
            EmployerName = "",  // Missing required field
            MonthlyIncome = 0,  // Invalid
            LoanAmount = 300000m,
            TenureMonths = 60,
            LoanPurpose = "Home Loan"
        };

        _mockRepository.Setup(r => r.GetByIdAsync(applicationId))
            .ReturnsAsync(application);

        // Act
        var result = await _applicationService.SubmitApplicationAsync(applicationId, applicantId);

        // Assert
        Assert.That(result.Success, Is.False);
        Assert.That(result.Errors, Is.Not.Null.And.Not.Empty);
    }
}
