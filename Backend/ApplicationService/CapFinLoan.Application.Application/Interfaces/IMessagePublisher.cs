using CapFinLoan.Application.Application.DTOs;

namespace CapFinLoan.Application.Application.Interfaces
{
	public interface IMessagePublisher
	{
		Task PublishApplicationStatusChangedAsync(
			ApplicationStatusChangedEvent message,
			CancellationToken cancellationToken = default);

		Task PublishApplicationSubmittedAsync(
			ApplicationStatusChangedEvent message,
			CancellationToken cancellationToken = default);
	}
}