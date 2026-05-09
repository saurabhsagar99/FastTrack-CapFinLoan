using CapFinLoan.Admin.Application.Common;
using CapFinLoan.Admin.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Admin.API.Controllers
{
	/// <summary>
	/// Provides admin endpoints for dashboard reporting and summary statistics.
	/// </summary>
	[ApiController]
	[Route("api/admin/reports")]
	[Authorize(Roles = "ADMIN")]
	public class ReportsController : ControllerBase
	{
		private readonly IAdminService _adminService;

		public ReportsController(IAdminService adminService)
		{
			_adminService = adminService;
		}

		/// <summary>
		/// Returns summary statistics: total applications, approved count, rejected count.
		/// </summary>
		[HttpGet("summary")]
		public async Task<IActionResult> GetSummary()
		{
			var result = await _adminService.GetReportsSummaryAsync();
			return Ok(ApiResponse<object>.Ok(result));
		}
	}
}
