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

		[HttpGet("my")]
		public async Task<IActionResult> GetMyApplications()
		{
			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.GetMyApplicationsAsync(applicantId);
			return result.Success ? Ok(result) : BadRequest(result);
		}

		[HttpGet("{id:int}")]
		public async Task<IActionResult> GetById(int id)
		{
			var result = await _service.GetByIdAsync(id);
			return result.Success ? Ok(result) : NotFound(result);
		}

		[HttpGet]
		[Authorize(Roles = "ADMIN")]
		public async Task<IActionResult> GetAll()
		{
			var result = await _service.GetAllAsync();
			return Ok(result);
		}

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

		[HttpPut("{id:int}")]
		public async Task<IActionResult> UpdateDraft(int id, [FromBody] UpdateApplicationDto dto)
		{
			if (!ModelState.IsValid) return BadRequest(ModelState);

			var applicantId = GetApplicantId();
			if (applicantId == null) return Unauthorized();

			var result = await _service.UpdateDraftAsync(id, applicantId, dto);
			return result.Success ? Ok(result) : BadRequest(result);
		}

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
