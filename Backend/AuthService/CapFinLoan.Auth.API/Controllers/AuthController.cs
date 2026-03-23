using CapFinLoan.Auth.Application.Common;
using CapFinLoan.Auth.Application.DTOs;
using CapFinLoan.Auth.Application.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Auth.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
	private readonly IAuthService _authService;

	public AuthController(IAuthService authService) => _authService = authService;

	[HttpPost("signup")]
	public async Task<IActionResult> Register([FromBody] RegisterDto dto)
	{
		var result = await _authService.RegisterAsync(dto);
		return Ok(ApiResponse<AuthResponseDto>.Ok(result, "Registration successful"));
	}

	[HttpPost("login")]
	public async Task<IActionResult> Login([FromBody] LoginDto dto)
	{
		var result = await _authService.LoginAsync(dto);
		return Ok(ApiResponse<AuthResponseDto>.Ok(result, "Login successful"));
	}
}