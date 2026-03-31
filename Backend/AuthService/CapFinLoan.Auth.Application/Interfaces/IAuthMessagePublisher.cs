using CapFinLoan.Auth.Application.DTOs;

namespace CapFinLoan.Auth.Application.Interfaces
{
	public interface IAuthMessagePublisher
	{
		Task PublishUserRegisteredAsync(
			AuthUserRegisteredEvent message,
			CancellationToken cancellationToken = default);
	}
}