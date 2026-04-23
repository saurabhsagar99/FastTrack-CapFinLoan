namespace CapFinLoan.Application.API.Services
{
	/// <summary>
	/// Interface for communicating with the Document Service
	/// </summary>
	public interface IDocumentServiceClient
	{
		/// <summary>
		/// Check if all required documents are uploaded for an application
		/// </summary>
		Task<bool> AreAllRequiredDocumentsUploadedAsync(int applicationId);
	}
}
