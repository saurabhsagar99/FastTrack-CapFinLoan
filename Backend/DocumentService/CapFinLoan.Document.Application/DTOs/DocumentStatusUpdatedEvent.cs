namespace CapFinLoan.Document.Application.DTOs
{
	public class DocumentStatusUpdatedEvent
	{
		public int DocumentId { get; set; }
		public int ApplicationId { get; set; }
		public bool IsVerified { get; set; }
		public string VerificationStatus { get; set; } = string.Empty;
		public string? VerificationRemarks { get; set; }
		public DateTime UpdatedAtUtc { get; set; }
	}
}