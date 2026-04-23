using System.Text.Json;

namespace CapFinLoan.Application.API.Services
{
	/// <summary>
	/// HTTP client for communicating with the Document Service
	/// </summary>
	public class DocumentServiceClient : IDocumentServiceClient
	{
		private readonly HttpClient _httpClient;
		private readonly ILogger<DocumentServiceClient> _logger;

		public DocumentServiceClient(HttpClient httpClient, ILogger<DocumentServiceClient> logger)
		{
			_httpClient = httpClient;
			_logger = logger;
		}

		/// <summary>
		/// Check if all required documents are uploaded for an application
		/// </summary>
		public async Task<bool> AreAllRequiredDocumentsUploadedAsync(int applicationId)
		{
			try
			{
				var response = await _httpClient.GetAsync($"/api/documents/application/{applicationId}/required");
				
				if (!response.IsSuccessStatusCode)
				{
					_logger.LogWarning($"Document service returned {response.StatusCode} for application {applicationId}");
					return false;
				}

				var jsonContent = await response.Content.ReadAsStringAsync();
				using (var jsonDoc = JsonDocument.Parse(jsonContent))
				{
					var root = jsonDoc.RootElement;
					
					// Navigate through the response structure: { "success": true, "data": { "allRequiredDocumentsUploaded": true } }
					if (root.TryGetProperty("data", out var dataElement) &&
						dataElement.TryGetProperty("allRequiredDocumentsUploaded", out var uploadedElement))
					{
						return uploadedElement.GetBoolean();
					}
				}

				return false;
			}
			catch (Exception ex)
			{
				_logger.LogError(ex, $"Error checking required documents for application {applicationId}");
				return false;
			}
		}
	}
}
