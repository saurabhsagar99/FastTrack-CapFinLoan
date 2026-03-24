using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace CapFinLoan.Document.Application.DTOs
{
	public class UploadDocumentDto
	{
		public int ApplicationId { get; set; }
		public string DocumentType { get; set; } = string.Empty;
		public IFormFile File { get; set; } = null!;
	}

	public class DocumentResponseDto
	{
		public int Id { get; set; }
		public int ApplicationId { get; set; }
		public string FileName { get; set; } = string.Empty;
		public string DocumentType { get; set; } = string.Empty;
		public bool IsVerified { get; set; }
		public string? VerificationRemarks { get; set; }
		public DateTime UploadedAt { get; set; }
	}

	public class VerifyDocumentDto
	{
		public bool IsVerified { get; set; }
		public string? Remarks { get; set; }
	}
}
