using CapFinLoan.Admin.Application.DTOs;

namespace CapFinLoan.Admin.Application.Interfaces
{
	public interface IAdminMessagePublisher
	{
		Task PublishDecisionCreatedAsync(
			AdminDecisionCreatedEvent message,
			CancellationToken cancellationToken = default);
	}
}