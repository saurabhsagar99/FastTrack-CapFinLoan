using CapFinLoan.Admin.Application.Common;
using CapFinLoan.Admin.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Admin.API.Controllers
{
	/// <summary>
	/// Provides admin endpoints for retrieving and managing decisions on loan applications.
	/// </summary>
	[ApiController]
	[Route("api/admin/decisions")]
	[Authorize(Roles = "ADMIN")]
	public class DecisionsController : ControllerBase
	{
		private readonly IAdminService _adminService;
		private readonly IDecisionRepository _repository;

		public DecisionsController(IAdminService adminService, IDecisionRepository repository)
		{
			_adminService = adminService;
			_repository = repository;
		}

		/// <summary>
		/// Retrieves the decision record (if any) for a given application.
		/// </summary>
		[HttpGet("application/{applicationId:int}")]
		public async Task<IActionResult> GetDecisionByApplication(int applicationId)
		{
			var decision = await _repository.GetByApplicationIdAsync(applicationId);
			if (decision == null)
				return NotFound(ApiResponse<object>.Fail("No decision found for this application."));

			return Ok(ApiResponse<object>.Ok(new
			{
				decision.Id,
				decision.ApplicationId,
				decision.Status,
				decision.Remarks,
				decision.SanctionTerms,
				decision.AdminEmail,
				decision.DecisionDate
			}));
		}
	}
}
