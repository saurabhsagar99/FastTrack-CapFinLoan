using System;
using System.Collections.Generic;
using System.Text;

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
		public string DocumentType { get; set; } = string.Empty; 
		public bool IsVerified { get; set; } = false;
		public string? VerificationRemarks { get; set; }
		public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
		public DateTime? VerifiedAt { get; set; }
	}
}
