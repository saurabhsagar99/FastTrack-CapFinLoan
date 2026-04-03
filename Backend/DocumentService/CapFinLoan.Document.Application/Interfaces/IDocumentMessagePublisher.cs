using CapFinLoan.Document.Application.DTOs;

namespace CapFinLoan.Document.Application.Interfaces
{
	public interface IDocumentMessagePublisher
	{
		Task PublishDocumentStatusUpdatedAsync(
			DocumentStatusUpdatedEvent message,
			CancellationToken cancellationToken = default);
	}
}