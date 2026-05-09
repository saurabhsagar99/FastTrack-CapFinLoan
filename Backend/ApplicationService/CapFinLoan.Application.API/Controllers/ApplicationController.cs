using CapFinLoan.Application.Application.Common;
using CapFinLoan.Application.Application.DTOs;
using CapFinLoan.Application.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CapFinLoan.Application.API.Controllers
{
	[ApiController]
	[Route("api/applications")]
	[Authorize]
	public class ApplicationController : ControllerBase
	{
		private readonly IApplicationService _service;

		public ApplicationController(IApplicationService service)
		{
			_service = service;
		}

		/// <summary>
		/// Returns the signed-in applicant's applications.
		/// </summary>
		[HttpGet("my")]
		public async Task<IActionResult> GetMyApplications()
		{
			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.GetMyApplicationsAsync(applicantId);
			return result.Success ? Ok(result) : BadRequest(result);
		}

		/// <summary>
		/// Fetches a single application by its identifier.
		/// </summary>
		[HttpGet("{id:int}")]
		public async Task<IActionResult> GetById(int id)
		{
			var result = await _service.GetByIdAsync(id);
			return result.Success ? Ok(result) : NotFound(result);
		}

		/// <summary>
		/// Returns the admin-facing application queue.
		/// </summary>
		[HttpGet]
		[Authorize(Roles = "ADMIN")]
		public async Task<IActionResult> GetAll()
		{
			var result = await _service.GetAllAsync();
			return Ok(result);
		}

		/// <summary>
		/// Creates a draft application for the current applicant.
		/// </summary>
		[HttpPost]
		public async Task<IActionResult> CreateDraft([FromBody] CreateApplicationDto dto)
		{
			if (!ModelState.IsValid) return BadRequest(ModelState);

			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.CreateDraftAsync(applicantId, dto);
			return result.Success
				? CreatedAtAction(nameof(GetById), new { id = result.Data!.Id }, result)
				: BadRequest(result);
		}

		/// <summary>
		/// Updates a saved draft application.
		/// </summary>
		[HttpPut("{id:int}")]
		public async Task<IActionResult> UpdateDraft(int id, [FromBody] UpdateApplicationDto dto)
		{
			if (!ModelState.IsValid) return BadRequest(ModelState);

			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.UpdateDraftAsync(id, applicantId, dto);
			return result.Success ? Ok(result) : BadRequest(result);
		}

		/// <summary>
		/// Builds a simple timeline view of the current application status.
		/// </summary>
		[HttpGet("{id:int}/status")]
		public async Task<IActionResult> GetApplicationStatus(int id)
		{
			var result = await _service.GetByIdAsync(id);
			if (!result.Success) return NotFound(result);

			var app = result.Data;
			var latestDescription = string.IsNullOrWhiteSpace(app.StatusNote)
				? "Latest status update"
				: $"Latest status update: {app.StatusNote}";
			return Ok(ApiResponse<object>.Ok(new
			{
				ApplicationId = app.Id,
				CurrentStatus = app.Status,
				CurrentRemark = app.StatusNote,
				Timeline = new object[]
				{
					new { Status = "Draft", Date = app.CreatedAt, Description = "Application created" },
					app.SubmittedAt.HasValue ? new { Status = "Submitted", Date = app.SubmittedAt.Value, Description = "Application submitted" } : null,
					new { Status = app.Status, Date = app.UpdatedAt, Description = latestDescription }
				}.Where(x => x != null)
			}));
		}

		/// <summary>
		/// Applies an admin status update to an application.
		/// </summary>
		[HttpPut("{id:int}/status")]
		[Authorize(Roles = "ADMIN")]
		public async Task<IActionResult> UpdateStatusByAdmin(int id, [FromBody] UpdateApplicationStatusDto dto)
		{
			if (!ModelState.IsValid) return BadRequest(ModelState);

			var result = await _service.UpdateStatusByAdminAsync(id, dto);
			return result.Success ? Ok(result) : BadRequest(result);
		}

		/// <summary>
		/// Submits a draft application for review.
		/// </summary>
		[HttpPost("{id:int}/submit")]
		public async Task<IActionResult> Submit(int id)
		{
			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.SubmitApplicationAsync(id, applicantId);
			return result.Success ? Ok(result) : BadRequest(result);
		}

		private string? GetApplicantId()
		{
			return User.FindFirstValue(ClaimTypes.NameIdentifier)
				?? User.FindFirstValue("sub");
		}
	}
}
