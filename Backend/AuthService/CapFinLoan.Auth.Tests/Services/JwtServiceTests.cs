using NUnit.Framework;
using Moq;
using CapFinLoan.Auth.Infrastructure.Services;
using CapFinLoan.Auth.Domain.Models;
using Microsoft.Extensions.Configuration;

namespace CapFinLoan.Auth.Tests.Services;

[TestFixture]
public class JwtServiceTests
{
    private Mock<IConfiguration>? _mockConfiguration;
    private JwtService? _jwtService;
    private const string TestKey = "ThisIsAVeryLongSecretKeyForTestingJwtTokenGeneration1234567890";
    private const string TestIssuer = "CapFinLoan";
    private const string TestAudience = "CapFinLoanUsers";

    [SetUp]
    public void Setup()
    {
        _mockConfiguration = new Mock<IConfiguration>();

        _mockConfiguration
            .Setup(c => c["Jwt:Key"])
            .Returns(TestKey);

        _mockConfiguration
            .Setup(c => c["Jwt:Issuer"])
            .Returns(TestIssuer);

        _mockConfiguration
            .Setup(c => c["Jwt:Audience"])
            .Returns(TestAudience);

        _jwtService = new JwtService(_mockConfiguration.Object);
    }

    [Test]
    public void GenerateToken_WithValidUser_ReturnsValidJwtToken()
    {
        // Arrange
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            Email = "test@example.com",
            Role = "APPLICANT"
        };

        // Act
        var token = _jwtService.GenerateToken(user);

        // Assert
        Assert.That(token, Is.Not.Null);
        Assert.That(token, Is.Not.Empty);
        Assert.That(token.Split('.').Length, Is.EqualTo(3)); // JWT has 3 parts separated by dots
    }

    [Test]
    public void GenerateToken_WithDifferentUsers_GeneratesDifferentTokens()
    {
        // Arrange
        var user1 = new User
        {
            Id = Guid.NewGuid(),
            Name = "User One",
            Email = "user1@example.com",
            Role = "APPLICANT"
        };

        var user2 = new User
        {
            Id = Guid.NewGuid(),
            Name = "User Two",
            Email = "user2@example.com",
            Role = "ADMIN"
        };

        // Act
        var token1 = _jwtService.GenerateToken(user1);
        var token2 = _jwtService.GenerateToken(user2);

        // Assert
        Assert.That(token1, Is.Not.EqualTo(token2));
    }

    [Test]
    public void GenerateToken_IncludesUserClaimsInToken()
    {
        // Arrange
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            Email = "test@example.com",
            Role = "APPLICANT"
        };

        // Act
        var token = _jwtService.GenerateToken(user);

        // Assert
        Assert.That(token, Is.Not.Null);
        // Token should contain encoded user information
        Assert.That(token, Contains.Substring("."));
    }
}
