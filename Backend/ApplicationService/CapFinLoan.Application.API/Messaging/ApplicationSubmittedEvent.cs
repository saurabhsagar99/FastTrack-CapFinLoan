namespace CapFinLoan.Application.API.Messaging
{
	public class ApplicationSubmittedEvent
	{
		public int ApplicationId { get; set; }
		public string ApplicantId { get; set; } = string.Empty;
		public string Status { get; set; } = string.Empty;
		public string? StatusNote { get; set; }
		public DateTime UpdatedAtUtc { get; set; }
	}
}