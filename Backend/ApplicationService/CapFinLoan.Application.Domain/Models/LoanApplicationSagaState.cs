namespace CapFinLoan.Application.Domain.Models
{
	public class LoanApplicationSagaState
	{
		public int Id { get; set; }
		public int ApplicationId { get; set; }
		public string CurrentStep { get; set; } = string.Empty;
		public string LastEventName { get; set; } = string.Empty;
		public string? LastMessage { get; set; }
		public bool IsCompleted { get; set; }
		public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
		public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
		public DateTime? CompletedAtUtc { get; set; }
	}
}