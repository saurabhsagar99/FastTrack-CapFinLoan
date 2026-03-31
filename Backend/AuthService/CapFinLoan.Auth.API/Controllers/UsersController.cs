using System;
using CapFinLoan.Auth.Application.Common;
using CapFinLoan.Auth.Persistence.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Auth.API.Controllers;

[ApiController]
[Route("api/auth/users")]
[Authorize]
public class UsersController : ControllerBase
{
	private readonly IUserRepository _userRepository;

	public UsersController(IUserRepository userRepository)
	{
		_userRepository = userRepository;
	}

	[HttpGet]
	[Authorize(Roles = "ADMIN")]
	public async Task<IActionResult> GetAllUsers()
	{
		try
		{
			var users = await _userRepository.GetAllAsync();
			var result = users.Select(u => new
			{
				u.Id,
				u.Name,
				u.Email,
				u.Phone,
				u.Role,
				u.IsActive
			});
			return Ok(ApiResponse<object>.Ok(result, "Users retrieved successfully"));
		}
		catch (Exception ex)
		{
			return BadRequest(ApiResponse<object>.Fail($"Error retrieving users: {ex.Message}"));
		}
	}

	[HttpPut("{id}/status")]
	[Authorize(Roles = "ADMIN")]
	public async Task<IActionResult> UpdateUserStatus(Guid id, [FromBody] UpdateUserStatusDto dto)
	{
		try
		{
			var user = await _userRepository.GetByIdAsync(id);
			if (user == null)
				return NotFound(ApiResponse<object>.Fail($"User with ID {id} not found"));

			user.IsActive = dto.IsActive;
			await _userRepository.UpdateAsync(user);

			return Ok(ApiResponse<object>.Ok(new
			{
				user.Id,
				user.Name,
				user.Email,
				user.IsActive
			}, $"User status updated to {(dto.IsActive ? "Active" : "Inactive")}"));
		}
		catch (Exception ex)
		{
			return BadRequest(ApiResponse<object>.Fail($"Error updating user status: {ex.Message}"));
		}
	}
}

public class UpdateUserStatusDto
{
	public bool IsActive { get; set; }
}
