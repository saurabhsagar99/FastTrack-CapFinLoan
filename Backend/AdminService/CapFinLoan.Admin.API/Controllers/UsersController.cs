using System.Security.Claims;
using CapFinLoan.Admin.Application.Common;
using CapFinLoan.Admin.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Admin.API.Controllers
{
	[ApiController]
	[Route("api/admin/users")]
	[Authorize(Roles = "ADMIN")]
	public class UsersController : ControllerBase
	{
		private readonly IAdminService _adminService;

		public UsersController(IAdminService adminService)
		{
			_adminService = adminService;
		}

		[HttpGet]
		public async Task<IActionResult> GetAllUsers()
		{
			var result = await _adminService.GetAllUsersAsync();
			return Ok(ApiResponse<object>.Ok(result));
		}

		[HttpPut("{id}/status")]
		public async Task<IActionResult> ToggleUserStatus(string id, [FromBody] ToggleUserStatusDto dto)
		{
			var result = await _adminService.ToggleUserStatusAsync(id, dto.IsActive);
			return Ok(ApiResponse<object>.Ok(result, "User status updated successfully."));
		}
	}

	public class ToggleUserStatusDto
	{
		public bool IsActive { get; set; }
	}
}
