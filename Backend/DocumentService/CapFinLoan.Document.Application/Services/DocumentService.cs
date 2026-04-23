using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Domain.Models;
using CapFinLoan.Document.Domain.Enums;

namespace CapFinLoan.Document.Application.Services
{
	public class DocumentService : IDocumentService
	{
		private readonly IDocumentRepository _repository;
		private readonly IFileStorageService _fileStorage;
		private readonly IDocumentMessagePublisher _messagePublisher;

		private static readonly string[] AllowedExtensions = { ".pdf", ".jpg", ".jpeg", ".png" };
		private const long MaxFileSizeBytes = 5 * 1024 * 1024; 

		public DocumentService(
			IDocumentRepository repository,
			IFileStorageService fileStorage,
			IDocumentMessagePublisher messagePublisher)
		{
			_repository = repository;
			_fileStorage = fileStorage;
			_messagePublisher = messagePublisher;
		}

		public async Task<DocumentResponseDto> UploadDocumentAsync(UploadDocumentDto dto, string userId)
		{
			var ext = Path.GetExtension(dto.File.FileName).ToLowerInvariant();

			if (!AllowedExtensions.Contains(ext))
				throw new InvalidOperationException("File type not allowed. Use PDF, JPG, or PNG.");

			if (dto.File.Length > MaxFileSizeBytes)
				throw new InvalidOperationException("File size exceeds 5 MB limit.");

			// Validate and parse DocumentType
			if (!Enum.TryParse<DocumentType>(dto.DocumentType, ignoreCase: true, out var documentType))
			{
				throw new InvalidOperationException($"Invalid document type: {dto.DocumentType}. Allowed types: KYC, AddressProof, IncomeProof, BankStatement");
			}

			var savedPath = await _fileStorage.SaveFileAsync(
				dto.File.OpenReadStream(),
				dto.File.FileName,
				$"app_{dto.ApplicationId}");

			// Remove only existing document of the same type for this user (allow multiple documents per app, one per type)
			var existingDoc = (await _repository.GetByApplicationIdAsync(dto.ApplicationId))
				.FirstOrDefault(d => d.UserId == userId && d.DocumentType == documentType);

			if (existingDoc != null)
			{
				_fileStorage.DeleteFile(existingDoc.FilePath);
				await _repository.DeleteAsync(existingDoc);
			}

			var entity = new DocumentEntity
			{
				ApplicationId = dto.ApplicationId,
				UserId = userId,
				FileName = dto.File.FileName,
				FilePath = savedPath,
				FileType = ext,
				FileSize = dto.File.Length,
				DocumentType = documentType,
				IsRequired = true,
				UploadedAt = DateTime.UtcNow
			};

			var saved = await _repository.AddAsync(entity);
			return MapToDto(saved);
		}

		public async Task<IEnumerable<DocumentResponseDto>> GetDocumentsByApplicationAsync(int applicationId)
		{
			var docs = await _repository.GetByApplicationIdAsync(applicationId);
			return docs.Select(MapToDto);
		}

		public async Task<RequiredDocumentsChecklistDto> GetRequiredDocumentsChecklistAsync(int applicationId)
		{
			var requiredDocTypes = new[] { DocumentType.KYC, DocumentType.AddressProof, DocumentType.IncomeProof, DocumentType.BankStatement };
			var uploadedDocs = (await _repository.GetByApplicationIdAsync(applicationId))
				.Where(d => d.IsRequired)
				.ToList();

			var checklist = new RequiredDocumentsChecklistDto
			{
				ApplicationId = applicationId,
				RequiredDocuments = requiredDocTypes.Select(docType => 
				{
					var uploadedDoc = uploadedDocs.FirstOrDefault(d => d.DocumentType == docType);
					return new RequiredDocumentDto
					{
						DocumentType = docType.ToString(),
						DisplayName = GetDocumentDisplayName(docType),
						IsUploaded = uploadedDoc != null,
						IsVerified = uploadedDoc?.IsVerified ?? false,
						VerificationRemarks = uploadedDoc?.VerificationRemarks
					};
				}).ToList()
			};

			checklist.AllRequiredDocumentsUploaded = checklist.RequiredDocuments.All(d => d.IsUploaded);
			return checklist;
		}

		public async Task<DocumentResponseDto> VerifyDocumentAsync(int docId, VerifyDocumentDto dto)
		{
			var doc = await _repository.GetByIdAsync(docId)
				?? throw new KeyNotFoundException($"Document {docId} not found.");

			if (!dto.IsVerified && string.IsNullOrWhiteSpace(dto.Remarks))
				throw new InvalidOperationException("Remarks are required when rejecting a document.");

			var verificationStatus = dto.IsVerified ? "Verified" : "Rejected";

			doc.IsVerified = dto.IsVerified;
			doc.VerificationRemarks = dto.Remarks;
			doc.VerifiedAt = DateTime.UtcNow;

			await _repository.UpdateAsync(doc);
			await _messagePublisher.PublishDocumentStatusUpdatedAsync(new DocumentStatusUpdatedEvent
			{
				DocumentId = doc.Id,
				ApplicationId = doc.ApplicationId,
				IsVerified = doc.IsVerified,
				VerificationStatus = verificationStatus,
				VerificationRemarks = doc.VerificationRemarks,
				UpdatedAtUtc = doc.VerifiedAt ?? DateTime.UtcNow
			});
			return MapToDto(doc);
		}

		public async Task<DocumentFileDto> GetDocumentFileAsync(int docId, string userId, bool isAdmin)
		{
			var doc = isAdmin
				? await _repository.GetByIdAsync(docId)
				: await _repository.GetByIdAndUserAsync(docId, userId);

			if (doc == null)
				throw new KeyNotFoundException($"Document {docId} not found.");

			// Try absolute path first, then relative for backward compatibility
			string filePath = doc.FilePath;
			if (!File.Exists(filePath))
			{
				// If absolute path doesn't work, try as relative path from current directory
				var relativePath = Path.GetFileName(filePath);
				if (!string.IsNullOrEmpty(relativePath))
				{
					// Try in Uploads folder structure
					var appFolder = Path.GetFileName(Path.GetDirectoryName(filePath)) ?? "";
					var altPath = Path.Combine("Uploads", appFolder, relativePath);
					if (File.Exists(altPath))
					{
						filePath = altPath;
					}
				}
			}

			if (!File.Exists(filePath))
				throw new FileNotFoundException("Document file not found on server.", doc.FilePath);

			return new DocumentFileDto
			{
				FileName = doc.FileName,
				ContentType = ResolveContentType(doc.FileType),
				Content = await File.ReadAllBytesAsync(filePath)
			};
		}

		public async Task<bool> DeleteDocumentAsync(int docId, string userId)
		{
			var doc = await _repository.GetByIdAndUserAsync(docId, userId);
			if (doc == null) return false;

			_fileStorage.DeleteFile(doc.FilePath);
			await _repository.DeleteAsync(doc);
			return true;
		}

		private static DocumentResponseDto MapToDto(DocumentEntity d) => new()
		{
			Id = d.Id,
			ApplicationId = d.ApplicationId,
			FileName = d.FileName,
			DocumentType = d.DocumentType.ToString(),
			IsVerified = d.IsVerified,
			IsRequired = d.IsRequired,
			VerificationRemarks = d.VerificationRemarks,
			UploadedAt = d.UploadedAt
		};

		private static string GetDocumentDisplayName(DocumentType documentType) => documentType switch
		{
			DocumentType.KYC => "KYC Document (Aadhar/PAN Card)",
			DocumentType.AddressProof => "Address Proof",
			DocumentType.IncomeProof => "Income Proof (Salary Slip/Tax Return)",
			DocumentType.BankStatement => "Bank Statement",
			_ => documentType.ToString()
		};

		private static string ResolveContentType(string ext)
		{
			return ext.ToLowerInvariant() switch
			{
				".pdf" => "application/pdf",
				".jpg" => "image/jpeg",
				".jpeg" => "image/jpeg",
				".png" => "image/png",
				_ => "application/octet-stream"
			};
		}
	}
}