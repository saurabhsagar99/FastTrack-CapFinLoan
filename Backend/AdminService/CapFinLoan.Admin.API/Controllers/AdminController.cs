using System.Security.Claims;
using CapFinLoan.Admin.Application.Common;
using CapFinLoan.Admin.Application.DTOs;
using CapFinLoan.Admin.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Admin.API.Controllers
{

	[ApiController]
	[Route("api/admin")]
	[Authorize(Roles = "ADMIN")]
	public class AdminController : ControllerBase
	{
		private readonly IAdminService _adminService;

		public AdminController(IAdminService adminService)
		{
			_adminService = adminService;
		}


		[HttpGet("applications")]
		public async Task<IActionResult> GetQueue()
		{
			var result = await _adminService.GetApplicationQueueAsync();
			return Ok(ApiResponse<object>.Ok(result));
		}

		[HttpPost("applications/{id}/decision")]
		public async Task<IActionResult> MakeDecision(int id, [FromBody] DecisionDto dto)
		{
			var adminEmail = User.FindFirstValue(ClaimTypes.Email) ?? "unknown";
			var decision = await _adminService.MakeDecisionAsync(id, dto, adminEmail);
			return Ok(ApiResponse<object>.Ok(decision, "Decision recorded successfully."));
		}
	}
}
