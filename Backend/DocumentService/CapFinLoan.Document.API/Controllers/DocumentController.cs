using System.Security.Claims;
using CapFinLoan.Document.Application.Common;
using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CapFinLoan.Document.API.Controllers
{
	/// <summary>
	/// Provides document upload, retrieval, verification, and deletion endpoints.
	/// All endpoints require authentication.
	/// </summary>
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

		/// <summary>
		/// Uploads a document (PDF, JPG, PNG) for a specific application.
		/// Validates file type and size before storage.
		/// </summary>
		[HttpPost("upload")]
		public async Task<IActionResult> Upload([FromForm] UploadDocumentDto dto)
		{
			var userId = User.FindFirstValue(ClaimTypes.NameIdentifier)!;
			var result = await _documentService.UploadDocumentAsync(dto, userId);
			return Ok(ApiResponse<DocumentResponseDto>.Ok(result, "Document uploaded successfully."));
		}

		/// <summary>
		/// Retrieves all documents for a given application.
		/// </summary>
		[HttpGet("application/{applicationId}")]
		public async Task<IActionResult> GetByApplication(int applicationId)
		{
			var docs = await _documentService.GetDocumentsByApplicationAsync(applicationId);
			return Ok(ApiResponse<IEnumerable<DocumentResponseDto>>.Ok(docs));
		}

		/// <summary>
		/// Returns the checklist of required documents and their upload status.
		/// </summary>
		[HttpGet("application/{applicationId}/required")]
		public async Task<IActionResult> GetRequiredDocumentsChecklist(int applicationId)
		{
			var checklist = await _documentService.GetRequiredDocumentsChecklistAsync(applicationId);
			return Ok(ApiResponse<RequiredDocumentsChecklistDto>.Ok(checklist, "Required documents checklist retrieved."));
		}

		/// <summary>
		/// Admin endpoint to verify/reject a document with optional remarks.
		/// </summary>
		[HttpPut("{docId}/verify")]
		[Authorize(Roles = "ADMIN")]
		public async Task<IActionResult> Verify(int docId, [FromBody] VerifyDocumentDto dto)
		{
			var result = await _documentService.VerifyDocumentAsync(docId, dto);
			return Ok(ApiResponse<DocumentResponseDto>.Ok(result, "Document verification updated."));
		}

		/// <summary>
		/// Downloads a document file. Admins can download any document; applicants can only download their own.
		/// </summary>
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

		/// <summary>
		/// Deletes a document. Only the uploader or an admin can delete.
		/// </summary>
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
