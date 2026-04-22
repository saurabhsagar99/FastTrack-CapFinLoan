using NUnit.Framework;
using Moq;
using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using CapFinLoan.Admin.Application.Services;
using CapFinLoan.Admin.Domain.Models;
using CapFinLoan.Admin.Persistence.Repositories;

namespace CapFinLoan.Admin.Tests.Services;

[TestFixture]
public class AdminServiceTests
{
    private Mock<IDecisionRepository>? _mockRepository;
    private Mock<IUserRepository>? _mockUserRepository;
    private Mock<IAdminMessagePublisher>? _messagePublisher;
    private AdminService? _adminService;

    [SetUp]
    public void Setup()
    {
        _mockRepository = new Mock<IDecisionRepository>();
        _mockUserRepository = new Mock<IUserRepository>();
        _messagePublisher = new Mock<IAdminMessagePublisher>();

        _adminService = new AdminService(
            _mockRepository.Object,
            _mockUserRepository.Object,
            _messagePublisher.Object);
    }

    [Test]
    public async Task MakeDecisionAsync_WithApprovedStatus_PublishesDecisionEvent()
    {
        // Arrange
        var applicationId = 1;
        var adminEmail = "admin@example.com";
        var decisionDto = new DecisionDto
        {
            Status = "Approved",
            Remarks = "Good creditworthiness",
            SanctionTerms = "12% interest, 60 months"
        };

        var expectedDecision = new Decision
        {
            Id = 1,
            ApplicationId = applicationId,
            Status = "Approved",
            Remarks = "Good creditworthiness",
            SanctionTerms = "12% interest, 60 months",
            AdminEmail = adminEmail,
            DecisionDate = DateTime.UtcNow
        };

        _mockRepository!.Setup(r => r.GetByApplicationIdAsync(applicationId))
            .ReturnsAsync((Decision)null);

        _mockRepository!.Setup(r => r.AddAsync(It.IsAny<Decision>()))
            .ReturnsAsync(expectedDecision);

        _messagePublisher!.Setup(p => p.PublishDecisionCreatedAsync(It.IsAny<AdminDecisionCreatedEvent>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _adminService.MakeDecisionAsync(applicationId, decisionDto, adminEmail);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Status, Is.EqualTo("Approved"));
        Assert.That(result.AdminEmail, Is.EqualTo(adminEmail));
        _mockRepository!.Verify(r => r.AddAsync(It.IsAny<Decision>()), Times.Once);
        _messagePublisher!.Verify(p => p.PublishDecisionCreatedAsync(It.IsAny<AdminDecisionCreatedEvent>()), Times.Once);
    }

    [Test]
    public async Task MakeDecisionAsync_WithRejectedStatus_PublishesDecisionEvent()
    {
        // Arrange
        var applicationId = 2;
        var adminEmail = "admin@example.com";
        var decisionDto = new DecisionDto
        {
            Status = "Rejected",
            Remarks = "Low credit score",
            SanctionTerms = null
        };

        var expectedDecision = new Decision
        {
            Id = 2,
            ApplicationId = applicationId,
            Status = "Rejected",
            Remarks = "Low credit score",
            AdminEmail = adminEmail,
            DecisionDate = DateTime.UtcNow
        };

        _mockRepository!.Setup(r => r.GetByApplicationIdAsync(applicationId))
            .ReturnsAsync((Decision)null);

        _mockRepository!.Setup(r => r.AddAsync(It.IsAny<Decision>()))
            .ReturnsAsync(expectedDecision);

        // Act
        var result = await _adminService.MakeDecisionAsync(applicationId, decisionDto, adminEmail);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Status, Is.EqualTo("Rejected"));
        _mockRepository!.Verify(r => r.AddAsync(It.IsAny<Decision>()), Times.Once);
    }

    [Test]
    public async Task MakeDecisionAsync_UpdatesExistingDecision()
    {
        // Arrange
        var applicationId = 1;
        var adminEmail = "admin@example.com";
        var decisionDto = new DecisionDto
        {
            Status = "Approved",
            Remarks = "Updated decision",
            SanctionTerms = "Updated terms"
        };

        var existingDecision = new Decision
        {
            Id = 1,
            ApplicationId = applicationId,
            Status = "Pending",
            AdminEmail = "oldadmin@example.com"
        };

        var updatedDecision = new Decision
        {
            Id = 1,
            ApplicationId = applicationId,
            Status = "Approved",
            Remarks = "Updated decision",
            SanctionTerms = "Updated terms",
            AdminEmail = adminEmail,
            DecisionDate = DateTime.UtcNow
        };

        _mockRepository!.Setup(r => r.GetByApplicationIdAsync(applicationId))
            .ReturnsAsync(existingDecision);

        _mockRepository!.Setup(r => r.UpdateAsync(It.IsAny<Decision>()))
            .ReturnsAsync(updatedDecision);

        // Act
        var result = await _adminService.MakeDecisionAsync(applicationId, decisionDto, adminEmail);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Status, Is.EqualTo("Approved"));
        _mockRepository!.Verify(r => r.UpdateAsync(It.IsAny<Decision>()), Times.Once);
    }

    [Test]
    public async Task GetReportsSummaryAsync_ReturnsSummaryWithCounts()
    {
        // Arrange
        _mockRepository!.Setup(r => r.CountAsync())
            .ReturnsAsync(100);

        _mockRepository!.Setup(r => r.CountByStatusAsync("Approved"))
            .ReturnsAsync(70);

        _mockRepository!.Setup(r => r.CountByStatusAsync("Rejected"))
            .ReturnsAsync(30);

        // Act
        var result = await _adminService.GetReportsSummaryAsync();

        // Assert
        Assert.That(result, Is.Not.Null);
        var resultType = result.GetType();
        var totalProp = resultType.GetProperty("Total");
        var approvedProp = resultType.GetProperty("Approved");
        var rejectedProp = resultType.GetProperty("Rejected");
        Assert.That(totalProp?.GetValue(result), Is.EqualTo(100));
        Assert.That(approvedProp?.GetValue(result), Is.EqualTo(70));
        Assert.That(rejectedProp?.GetValue(result), Is.EqualTo(30));
    }

    [Test]
    public async Task GetApplicationQueueAsync_ReturnsDecisions()
    {
        // Arrange
        var decisions = new List<Decision>
        {
            new Decision { Id = 1, ApplicationId = 1, Status = "Pending", AdminEmail = "admin@example.com" },
            new Decision { Id = 2, ApplicationId = 2, Status = "Approved", AdminEmail = "admin@example.com" }
        };

        _mockRepository!.Setup(r => r.GetAllAsync())
            .ReturnsAsync(decisions);

        // Act
        var result = await _adminService.GetApplicationQueueAsync();

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Count(), Is.EqualTo(2));
    }
}
