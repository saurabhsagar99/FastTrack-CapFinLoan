using System;
using System.Collections.Generic;
using System.Text;
using CapFinLoan.Document.Domain.Enums;

namespace CapFinLoan.Document.Domain.Models
{
	public class DocumentEntity
	{
		public int Id { get; set; }
		public int ApplicationId { get; set; }
		public string UserId { get; set; } = string.Empty;
		public string FileName { get; set; } = string.Empty;
		public string FilePath { get; set; } = string.Empty;
		public string FileType { get; set; } = string.Empty;
		public long FileSize { get; set; }
		/// <summary>
		/// Document type using the DocumentType enum for required documents (KYC, AddressProof, IncomeProof, BankStatement)
		/// </summary>
		public DocumentType DocumentType { get; set; }
		/// <summary>
		/// Indicates if this is one of the 4 required documents for loan application
		/// </summary>
		public bool IsRequired { get; set; } = true;
		public bool IsVerified { get; set; } = false;
		public string? VerificationRemarks { get; set; }
		public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
		public DateTime? VerifiedAt { get; set; }
	}
}
