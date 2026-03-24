using CapFinLoan.Document.Application.DTOs;
using CapFinLoan.Document.Application.Interfaces;
using CapFinLoan.Document.Domain.Models;

namespace CapFinLoan.Document.Application.Services
{
	public class DocumentService : IDocumentService
	{
		private readonly IDocumentRepository _repository;
		private readonly IFileStorageService _fileStorage;

		private static readonly string[] AllowedExtensions = { ".pdf", ".jpg", ".jpeg", ".png" };
		private const long MaxFileSizeBytes = 5 * 1024 * 1024; 

		public DocumentService(IDocumentRepository repository, IFileStorageService fileStorage)
		{
			_repository = repository;
			_fileStorage = fileStorage;
		}

		public async Task<DocumentResponseDto> UploadDocumentAsync(UploadDocumentDto dto, string userId)
		{
			var ext = Path.GetExtension(dto.File.FileName).ToLowerInvariant();

			if (!AllowedExtensions.Contains(ext))
				throw new InvalidOperationException("File type not allowed. Use PDF, JPG, or PNG.");

			if (dto.File.Length > MaxFileSizeBytes)
				throw new InvalidOperationException("File size exceeds 5 MB limit.");

			var savedPath = await _fileStorage.SaveFileAsync(
				dto.File.OpenReadStream(),
				dto.File.FileName,
				$"app_{dto.ApplicationId}");

			var entity = new DocumentEntity
			{
				ApplicationId = dto.ApplicationId,
				UserId = userId,
				FileName = dto.File.FileName,
				FilePath = savedPath,
				FileType = ext,
				FileSize = dto.File.Length,
				DocumentType = dto.DocumentType,
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

		public async Task<DocumentResponseDto> VerifyDocumentAsync(int docId, VerifyDocumentDto dto)
		{
			var doc = await _repository.GetByIdAsync(docId)
				?? throw new KeyNotFoundException($"Document {docId} not found.");

			doc.IsVerified = dto.IsVerified;
			doc.VerificationRemarks = dto.Remarks;
			doc.VerifiedAt = DateTime.UtcNow;

			await _repository.UpdateAsync(doc);
			return MapToDto(doc);
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
			DocumentType = d.DocumentType,
			IsVerified = d.IsVerified,
			VerificationRemarks = d.VerificationRemarks,
			UploadedAt = d.UploadedAt
		};
	}
}