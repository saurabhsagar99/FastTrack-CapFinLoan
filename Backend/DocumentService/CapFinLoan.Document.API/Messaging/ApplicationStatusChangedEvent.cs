namespace CapFinLoan.Document.API.Messaging
{
	public class ApplicationStatusChangedEvent
	{
		public int ApplicationId { get; set; }
		public string ApplicantId { get; set; } = string.Empty;
		public string Status { get; set; } = string.Empty;
		public string? StatusNote { get; set; }
		public DateTime UpdatedAtUtc { get; set; }
	}
}