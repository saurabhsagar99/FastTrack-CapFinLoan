using System.Security.Claims;
using CapFinLoan.Document.Application.Common;
using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Document.API.Controllers
{
	[ApiController]
	[Route("api/[controller]")]
	[Authorize]
	public class DocumentController : ControllerBase
	{
		private readonly IDocumentService _documentService;

		public DocumentController(IDocumentService documentService)
		{
			_documentService = documentService;
		}

		[HttpPost("upload")]
		public async Task<IActionResult> Upload([FromForm] UploadDocumentDto dto)
		{
			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
			var result = await _documentService.UploadDocumentAsync(dto, userId);
			return Ok(ApiResponse<DocumentResponseDto>.Ok(result, "Document uploaded successfully."));
		}

		[HttpGet("application/{applicationId}")]
		public async Task<IActionResult> GetByApplication(int applicationId)
		{
			var docs = await _documentService.GetDocumentsByApplicationAsync(applicationId);
			return Ok(ApiResponse<IEnumerable<DocumentResponseDto>>.Ok(docs));
		}

		[HttpGet("application/{applicationId}/required")]
		public async Task<IActionResult> GetRequiredDocumentsChecklist(int applicationId)
		{
			var checklist = await _documentService.GetRequiredDocumentsChecklistAsync(applicationId);
			return Ok(ApiResponse<RequiredDocumentsChecklistDto>.Ok(checklist, "Required documents checklist retrieved."));
		}

		[HttpPut("{docId}/verify")]
		[Authorize(Roles = "ADMIN")]
		public async Task<IActionResult> Verify(int docId, [FromBody] VerifyDocumentDto dto)
		{
			var result = await _documentService.VerifyDocumentAsync(docId, dto);
			return Ok(ApiResponse<DocumentResponseDto>.Ok(result, "Document verification updated."));
		}

		[HttpGet("{docId}/download")]
		public async Task<IActionResult> Download(int docId)
		{
			var isAdmin = User.Claims.Any(c =>
				(c.Type == ClaimTypes.Role || c.Type == "role") &&
				string.Equals(c.Value, "ADMIN", StringComparison.OrdinalIgnoreCase));

			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)
				?? User.FindFirstValue("sub")
				?? string.Empty;

			if (!isAdmin && string.IsNullOrWhiteSpace(userId))
				return Unauthorized(ApiResponse<object>.Fail("User identity not found."));

			var file = await _documentService.GetDocumentFileAsync(docId, userId, isAdmin);
			return File(file.Content, file.ContentType, file.FileName);
		}

		[HttpDelete("{docId}")]
		public async Task<IActionResult> Delete(int docId)
		{
			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
			var deleted = await _documentService.DeleteDocumentAsync(docId, userId);
			if (!deleted) return NotFound(ApiResponse<bool>.Fail("Document not found."));
			return Ok(ApiResponse<bool>.Ok(true, "Document deleted."));
		}
	}
}
