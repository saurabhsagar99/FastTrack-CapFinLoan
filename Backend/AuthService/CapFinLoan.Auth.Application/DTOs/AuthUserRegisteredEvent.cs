namespace CapFinLoan.Auth.Application.DTOs
{
	public class AuthUserRegisteredEvent
	{
		public string UserId { get; set; } = string.Empty;
		public string Name { get; set; } = string.Empty;
		public string Email { get; set; } = string.Empty;
		public string Role { get; set; } = string.Empty;
		public DateTime RegisteredAtUtc { get; set; }
	}
}