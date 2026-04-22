using NUnit.Framework;
using Moq;
using CapFinLoan.Auth.Application.DTOs;
using CapFinLoan.Auth.Application.Interfaces;
using CapFinLoan.Auth.Application.Services;
using CapFinLoan.Auth.Domain.Models;
using CapFinLoan.Auth.Infrastructure.Services;
using CapFinLoan.Auth.Persistence.Repositories;

namespace CapFinLoan.Auth.Tests.Services;

[TestFixture]
public class AuthServiceTests
{
    private Mock<IUserRepository>? _mockUserRepository;
    private Mock<IJwtService>? _mockJwtService;
    private Mock<IAuthMessagePublisher>? _mockMessagePublisher;
    private AuthService? _authService;

    [SetUp]
    public void Setup()
    {
        _mockUserRepository = new Mock<IUserRepository>();
        _mockJwtService = new Mock<IJwtService>();
        _mockMessagePublisher = new Mock<IAuthMessagePublisher>();

        _authService = new AuthService(
            _mockUserRepository.Object,
            _mockJwtService.Object,
            _mockMessagePublisher.Object);
    }

    [Test]
    public async Task LoginAsync_WithValidCredentials_ReturnsAuthResponseDto()
    {
        // Arrange
        var loginDto = new LoginDto { Email = "test@example.com", Password = "Password123!" };
        var user = new User
        {
            Id = Guid.NewGuid(),
            Name = "Test User",
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            Role = "APPLICANT",
            IsActive = true
        };

        _mockUserRepository.Setup(r => r.GetByEmailAsync(loginDto.Email))
            .ReturnsAsync(user);

        _mockJwtService.Setup(j => j.GenerateToken(user))
            .Returns("valid-jwt-token");

        // Act
        var result = await _authService.LoginAsync(loginDto);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Token, Is.EqualTo("valid-jwt-token"));
        Assert.That(result.Role, Is.EqualTo("APPLICANT"));
        Assert.That(result.Name, Is.EqualTo("Test User"));
        _mockUserRepository.Verify(r => r.GetByEmailAsync(loginDto.Email), Times.Once);
    }

    [Test]
    public void LoginAsync_WithInvalidEmail_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var loginDto = new LoginDto { Email = "nonexistent@example.com", Password = "Password123!" };
        _mockUserRepository.Setup(r => r.GetByEmailAsync(loginDto.Email))
            .ReturnsAsync((User)null);

        // Act & Assert
        var ex = Assert.ThrowsAsync<UnauthorizedAccessException>(
            async () => await _authService.LoginAsync(loginDto));
        Assert.That(ex.Message, Contains.Substring("Invalid email or password"));
    }

    [Test]
    public void LoginAsync_WithInvalidPassword_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var loginDto = new LoginDto { Email = "test@example.com", Password = "WrongPassword" };
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("CorrectPassword123!"),
            IsActive = true
        };

        _mockUserRepository.Setup(r => r.GetByEmailAsync(loginDto.Email))
            .ReturnsAsync(user);

        // Act & Assert
        var ex = Assert.ThrowsAsync<UnauthorizedAccessException>(
            async () => await _authService.LoginAsync(loginDto));
        Assert.That(ex.Message, Contains.Substring("Invalid email or password"));
    }

    [Test]
    public void LoginAsync_WithInactiveUser_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var loginDto = new LoginDto { Email = "test@example.com", Password = "Password123!" };
        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = "test@example.com",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password123!"),
            IsActive = false
        };

        _mockUserRepository.Setup(r => r.GetByEmailAsync(loginDto.Email))
            .ReturnsAsync(user);

        // Act & Assert
        var ex = Assert.ThrowsAsync<UnauthorizedAccessException>(
            async () => await _authService.LoginAsync(loginDto));
        Assert.That(ex.Message, Contains.Substring("deactivated"));
    }

    [Test]
    public async Task RegisterAsync_WithValidData_CreatesUserAndPublishesEvent()
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Name = "New User",
            Email = "newuser@example.com",
            Phone = "1234567890",
            Password = "Password123!"
        };

        _mockUserRepository.Setup(r => r.GetByEmailAsync(registerDto.Email))
            .ReturnsAsync((User)null);

        _mockUserRepository!.Setup(r => r.AddAsync(It.IsAny<User>()))
            .Returns((User u) => Task.FromResult(u));

        _mockJwtService.Setup(j => j.GenerateToken(It.IsAny<User>()))
            .Returns("new-jwt-token");

        _mockMessagePublisher.Setup(p => p.PublishUserRegisteredAsync(It.IsAny<AuthUserRegisteredEvent>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _authService.RegisterAsync(registerDto);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result.Token, Is.EqualTo("new-jwt-token"));
        Assert.That(result.Role, Is.EqualTo("APPLICANT"));
        _mockUserRepository.Verify(r => r.AddAsync(It.IsAny<User>()), Times.Once);
        _mockMessagePublisher.Verify(p => p.PublishUserRegisteredAsync(It.IsAny<AuthUserRegisteredEvent>()), Times.Once);
    }

    [Test]
    public void RegisterAsync_WithExistingEmail_ThrowsInvalidOperationException()
    {
        // Arrange
        var registerDto = new RegisterDto
        {
            Name = "New User",
            Email = "existing@example.com",
            Phone = "1234567890",
            Password = "Password123!"
        };

        var existingUser = new User { Email = "existing@example.com" };
        _mockUserRepository.Setup(r => r.GetByEmailAsync(registerDto.Email))
            .ReturnsAsync(existingUser);

        // Act & Assert
        var ex = Assert.ThrowsAsync<InvalidOperationException>(
            async () => await _authService.RegisterAsync(registerDto));
        Assert.That(ex.Message, Contains.Substring("already registered"));
    }
}
