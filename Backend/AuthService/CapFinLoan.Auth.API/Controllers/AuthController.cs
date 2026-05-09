using CapFinLoan.Auth.Application.Common;
using CapFinLoan.Auth.Application.DTOs;
using CapFinLoan.Auth.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Auth.API.Controllers;

/// <summary>
/// Provides user authentication endpoints: login and registration.
/// </summary>
[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
	private readonly IAuthService _authService;

	public AuthController(IAuthService authService) => _authService = authService;

	/// <summary>
	/// Registers a new applicant account.
	/// </summary>
	[HttpPost("signup")]
	public async Task<IActionResult> Register([FromBody] RegisterDto dto)
	{
		var result = await _authService.RegisterAsync(dto);
		return Ok(ApiResponse<AuthResponseDto>.Ok(result, "Registration successful"));
	}

	/// <summary>
	/// Authenticates a user and returns a JWT token.
	/// </summary>
	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] LoginDto dto)
	{
		var result = await _authService.LoginAsync(dto);
		return Ok(ApiResponse<AuthResponseDto>.Ok(result, "Login successful"));
	}
}