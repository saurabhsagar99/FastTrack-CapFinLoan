namespace CapFinLoan.Application.API.Messaging
{
	public class AdminDecisionCreatedEvent
	{
		public int DecisionId { get; set; }
		public int ApplicationId { get; set; }
		public string Status { get; set; } = string.Empty;
		public string? Remarks { get; set; }
		public string? SanctionTerms { get; set; }
		public string AdminEmail { get; set; } = string.Empty;
		public DateTime DecisionDateUtc { get; set; }
	}
}