using System;
using System.Collections.Generic;
using System.Text;
using Microsoft.AspNetCore.Http;

namespace CapFinLoan.Document.Application.DTOs
{
	public class UploadDocumentDto
	{
		public int ApplicationId { get; set; }
		/// <summary>
		/// Document type: KYC, AddressProof, IncomeProof, or BankStatement
		/// </summary>
		public string DocumentType { get; set; } = string.Empty;
		public IFormFile File { get; set; } = null!;
	}

	public class DocumentResponseDto
	{
		public int Id { get; set; }
		public int ApplicationId { get; set; }
		public string FileName { get; set; } = string.Empty;
		/// <summary>
		/// Document type enum value as string: KYC, AddressProof, IncomeProof, or BankStatement
		/// </summary>
		public string DocumentType { get; set; } = string.Empty;
		public bool IsVerified { get; set; }
		public bool IsRequired { get; set; }
		public string? VerificationRemarks { get; set; }
		public DateTime UploadedAt { get; set; }
	}

	public class RequiredDocumentsChecklistDto
	{
		public int ApplicationId { get; set; }
		/// <summary>
		/// List of required documents and their upload status
		/// </summary>
		public List<RequiredDocumentDto> RequiredDocuments { get; set; } = new();
		/// <summary>
		/// Are all required documents uploaded?
		/// </summary>
		public bool AllRequiredDocumentsUploaded { get; set; }
	}

	public class RequiredDocumentDto
	{
		public string DocumentType { get; set; } = string.Empty;
		public string DisplayName { get; set; } = string.Empty;
		public bool IsUploaded { get; set; }
		public bool IsVerified { get; set; }
		public string? VerificationRemarks { get; set; }
	}

	public class VerifyDocumentDto
	{
		public bool IsVerified { get; set; }
		public string? Remarks { get; set; }
	}

	public class DocumentFileDto
	{
		public string FileName { get; set; } = string.Empty;
		public string ContentType { get; set; } = "application/octet-stream";
		public byte[] Content { get; set; } = Array.Empty<byte>();
	}
}
